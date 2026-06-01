import "server-only";

import { ValidationError } from "@/lib/api-errors";
import { getVcharaDb } from "@/lib/cloudflare-bindings";
import { createId, randomBase64Url, sha256Hex } from "@/lib/crypto-web";
import type { CodexWorkerSummary } from "@/lib/types";

const tokenPrefix = "vcw_";
const connectedWindowMs = 2 * 60 * 1000;
const activeWorkerLimit = 5;
const defaultTokenTtlDays = 30;

function tokenTtlDays() {
  const parsed = Number(process.env.CODEX_WORKER_TOKEN_TTL_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultTokenTtlDays;
  return Math.min(Math.floor(parsed), 90);
}

function nowDate() {
  return new Date();
}

function newTokenExpiresAt() {
  return new Date(Date.now() + tokenTtlDays() * 24 * 60 * 60 * 1000);
}

function connectedSince() {
  return new Date(Date.now() - connectedWindowMs);
}

async function hashToken(token: string) {
  return sha256Hex(token);
}

function createRawToken() {
  return `${tokenPrefix}${randomBase64Url(32)}`;
}

function normalizeWorkerName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return (name || "My Mac").slice(0, 48);
}

function toSummary(worker: {
  id: string;
  name: string;
  createdAt: Date | string;
  lastSeenAt: Date | string | null;
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
}): CodexWorkerSummary {
  const now = Date.now();
  const since = connectedSince().getTime();
  const expiresAt = worker.expiresAt ? new Date(worker.expiresAt) : undefined;
  const lastSeenAt = worker.lastSeenAt ? new Date(worker.lastSeenAt) : undefined;
  const revokedAt = worker.revokedAt ? new Date(worker.revokedAt) : undefined;
  const createdAt = new Date(worker.createdAt);
  const expired = !expiresAt || expiresAt.getTime() <= now;

  return {
    id: worker.id,
    name: worker.name,
    createdAt: createdAt.toISOString(),
    lastSeenAt: lastSeenAt?.toISOString(),
    expiresAt: expiresAt?.toISOString(),
    revokedAt: revokedAt?.toISOString(),
    expired,
    connected: !revokedAt && !expired && Boolean(lastSeenAt && lastSeenAt.getTime() >= since),
  };
}

export async function listUserCodexWorkers(userId: string) {
  const db = await getVcharaDb();
  const workers = await db.prepare(`
    SELECT "id", "name", "createdAt", "lastSeenAt", "expiresAt", "revokedAt"
    FROM "CodexWorker"
    WHERE "userId" = ?
    ORDER BY "createdAt" DESC
  `).bind(userId).all<{
    id: string;
    name: string;
    createdAt: string;
    lastSeenAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
  }>();

  return (workers.results ?? []).map(toSummary);
}

export async function createUserCodexWorker(userId: string, input?: { name?: unknown }) {
  const now = nowDate();
  const db = await getVcharaDb();
  const activeWorkers = await db.prepare(`
    SELECT COUNT(*) AS "count"
    FROM "CodexWorker"
    WHERE "userId" = ?
      AND "revokedAt" IS NULL
      AND "expiresAt" > ?
  `).bind(userId, now.toISOString()).first<{ count: number }>();

  if (Number(activeWorkers?.count) >= activeWorkerLimit) {
    throw new ValidationError("You can have up to five active Codex connections. Revoke unused connections.", [], 400);
  }

  const token = createRawToken();
  const worker = {
    id: createId("worker"),
    userId,
    name: normalizeWorkerName(input?.name),
    tokenHash: await hashToken(token),
    createdAt: now.toISOString(),
    lastSeenAt: null,
    expiresAt: newTokenExpiresAt().toISOString(),
    revokedAt: null,
  };

  await db.prepare(`
    INSERT INTO "CodexWorker" (
      "id", "userId", "name", "tokenHash", "createdAt", "lastSeenAt", "expiresAt", "revokedAt"
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    worker.id,
    worker.userId,
    worker.name,
    worker.tokenHash,
    worker.createdAt,
    worker.lastSeenAt,
    worker.expiresAt,
    worker.revokedAt,
  ).run();

  return {
    worker: toSummary(worker),
    token,
  };
}

export async function revokeUserCodexWorker(userId: string, workerId: string) {
  const db = await getVcharaDb();
  const worker = await db.prepare(`
    SELECT "id"
    FROM "CodexWorker"
    WHERE "id" = ? AND "userId" = ? AND "revokedAt" IS NULL
    LIMIT 1
  `).bind(workerId, userId).first<{ id: string }>();

  if (!worker) {
    throw new ValidationError("Codex worker not found", [], 404);
  }

  await db.prepare('UPDATE "CodexWorker" SET "revokedAt" = ? WHERE "id" = ?')
    .bind(nowDate().toISOString(), worker.id)
    .run();
}

export async function hasConnectedUserCodexWorker(userId: string) {
  const db = await getVcharaDb();
  const count = await db.prepare(`
    SELECT COUNT(*) AS "count"
    FROM "CodexWorker"
    WHERE "userId" = ?
      AND "revokedAt" IS NULL
      AND "expiresAt" > ?
      AND "lastSeenAt" >= ?
  `).bind(userId, nowDate().toISOString(), connectedSince().toISOString()).first<{ count: number }>();

  return Number(count?.count) > 0;
}

export async function authenticateCodexWorker(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token?.startsWith(tokenPrefix)) {
    throw new ValidationError("Invalid Codex worker token", [], 401);
  }

  const db = await getVcharaDb();
  const worker = await db.prepare(`
    SELECT "id", "userId", "name"
    FROM "CodexWorker"
    WHERE "tokenHash" = ?
      AND "revokedAt" IS NULL
      AND "expiresAt" > ?
    LIMIT 1
  `).bind(await hashToken(token), nowDate().toISOString()).first<{ id: string; userId: string; name: string }>();

  if (!worker) {
    throw new ValidationError("Invalid Codex worker token", [], 401);
  }

  await db.prepare('UPDATE "CodexWorker" SET "lastSeenAt" = ? WHERE "id" = ?')
    .bind(nowDate().toISOString(), worker.id)
    .run();

  return worker;
}
