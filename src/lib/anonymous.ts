import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ValidationError } from "@/lib/api-errors";
import { getVcharaDb } from "@/lib/cloudflare-bindings";
import { createId, randomBase64Url, sha256Hex } from "@/lib/crypto-web";
import { createAnonymousUser } from "@/lib/user-repository";

export const ANONYMOUS_COOKIE_NAME = "vcharastudio_anonymous_token";
export const ANONYMOUS_DAILY_LIMIT = 10;

export type AnonymousGenerationKind = "builder" | "studio";

export interface AnonymousActor {
  id: string;
  isAnonymous: true;
}

async function hashToken(token: string) {
  return sha256Hex(token);
}

function createToken() {
  return randomBase64Url(32);
}

function anonymousCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

function todayDateKeyInJapan() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export async function getAnonymousActorFromCookie(): Promise<AnonymousActor | undefined> {
  const token = (await cookies()).get(ANONYMOUS_COOKIE_NAME)?.value;
  if (!token) return undefined;

  const db = await getVcharaDb();
  const identity = await db.prepare(`
    SELECT i."claimedAt", u."id" AS "userId", u."isAnonymous"
    FROM "AnonymousIdentity" i
    INNER JOIN "User" u ON u."id" = i."userId"
    WHERE i."tokenHash" = ?
    LIMIT 1
  `).bind(await hashToken(token)).first<{ claimedAt: string | null; userId: string; isAnonymous: number }>();

  if (!identity || identity.claimedAt || !identity.isAnonymous) {
    return undefined;
  }

  return {
    id: identity.userId,
    isAnonymous: true,
  };
}

export async function ensureAnonymousActor(): Promise<AnonymousActor> {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(ANONYMOUS_COOKIE_NAME)?.value;

  if (currentToken) {
    const current = await getAnonymousActorFromCookie();
    if (current) return current;
  }

  const token = createToken();
  const user = await createAnonymousUser(await hashToken(token));

  cookieStore.set(ANONYMOUS_COOKIE_NAME, token, anonymousCookieOptions());

  return {
    id: user.id,
    isAnonymous: true,
  };
}

export async function reserveAnonymousGeneration(userId: string, kind: AnonymousGenerationKind) {
  const dateKey = todayDateKeyInJapan();
  const now = new Date();
  const nowIso = now.toISOString();
  const field = kind === "builder" ? "builderStartedAt" : "studioStartedAt";
  const actionLabel = kind === "builder" ? "form generation" : "image generation";
  const db = await getVcharaDb();
  const user = await db.prepare('SELECT "isAnonymous" FROM "User" WHERE "id" = ? LIMIT 1')
    .bind(userId)
    .first<{ isAnonymous: number }>();

  if (!user?.isAnonymous) {
    throw new ValidationError("Anonymous user not found", [], 404);
  }

  const existing = await db.prepare(`
    SELECT "id", "builderStartedAt", "studioStartedAt"
    FROM "AnonymousGenerationUsage"
    WHERE "dateKey" = ? AND "userId" = ?
    LIMIT 1
  `).bind(dateKey, userId).first<Record<string, unknown>>();

  if (existing?.[field]) {
    throw new ValidationError(`${actionLabel} anonymous quota has already been used today.`, [
      { field: kind, message: `Anonymous users can use ${actionLabel} once per day. Sign in with Google to continue.` },
    ], 429);
  }

  const startedCount = await db.prepare(`
    SELECT COUNT(*) AS "count"
    FROM "AnonymousGenerationUsage"
    WHERE "dateKey" = ? AND "${field}" IS NOT NULL
  `).bind(dateKey).first<{ count: number }>();

  if (Number(startedCount?.count) >= ANONYMOUS_DAILY_LIMIT) {
    throw new ValidationError("Today's anonymous generation quota is exhausted.", [
      { field: kind, message: "Today's anonymous generation quota has reached 10 users. Sign in with Google to use the normal quota." },
    ], 429);
  }

  if (existing?.id) {
    await db.prepare(`
      UPDATE "AnonymousGenerationUsage"
      SET "${field}" = ?, "updatedAt" = ?
      WHERE "id" = ?
    `).bind(nowIso, nowIso, existing.id).run();
    return;
  }

  await db.prepare(`
    INSERT INTO "AnonymousGenerationUsage" (
      "id", "dateKey", "userId", "builderStartedAt", "studioStartedAt", "createdAt", "updatedAt"
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    createId("anon_usage"),
    dateKey,
    userId,
    kind === "builder" ? nowIso : null,
    kind === "studio" ? nowIso : null,
    nowIso,
    nowIso,
  ).run();
}

export async function claimAnonymousDataForSignedInUser(userId: string, nextPath = "/") {
  const cookieStore = await cookies();
  const token = cookieStore.get(ANONYMOUS_COOKIE_NAME)?.value;
  if (!token) {
    redirect(nextPath);
  }

  const db = await getVcharaDb();
  const tokenHash = await hashToken(token);
  const identity = await db.prepare(`
    SELECT i."userId", i."claimedAt", u."isAnonymous"
    FROM "AnonymousIdentity" i
    INNER JOIN "User" u ON u."id" = i."userId"
    WHERE i."tokenHash" = ?
    LIMIT 1
  `).bind(tokenHash).first<{ userId: string; claimedAt: string | null; isAnonymous: number }>();

  if (!identity || identity.claimedAt || !identity.isAnonymous || identity.userId === userId) {
    cookieStore.delete(ANONYMOUS_COOKIE_NAME);
    redirect(nextPath);
  }

  const anonymousUserId = identity.userId;
  const existingTemplateKeys = await db.prepare(`
    SELECT "templateKey"
    FROM "Character"
    WHERE "userId" = ? AND "templateKey" IS NOT NULL
  `).bind(userId).all<{ templateKey: string }>();
  const duplicateTemplateKeys = (existingTemplateKeys.results ?? [])
    .map((character) => character.templateKey)
    .filter(Boolean);
  const statements: D1PreparedStatement[] = [];

  if (duplicateTemplateKeys.length) {
    const placeholders = duplicateTemplateKeys.map(() => "?").join(", ");
    const duplicateAnonymousCharacters = await db.prepare(`
      SELECT "id", "referencePackId", "consistencyAssetIds"
      FROM "Character"
      WHERE "userId" = ? AND "templateKey" IN (${placeholders})
    `).bind(anonymousUserId, ...duplicateTemplateKeys).all<{
      id: string;
      referencePackId: string | null;
      consistencyAssetIds: string;
    }>();

    const duplicateCharacterIds = (duplicateAnonymousCharacters.results ?? []).map((character) => character.id);
    const duplicateReferencePackIds = (duplicateAnonymousCharacters.results ?? [])
      .map((character) => character.referencePackId)
      .filter((referencePackId): referencePackId is string => Boolean(referencePackId));
    const duplicateAssetIds = (duplicateAnonymousCharacters.results ?? []).flatMap((character) => {
      try {
        const values = JSON.parse(character.consistencyAssetIds) as unknown;
        return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [];
      } catch {
        return [];
      }
    });

    if (duplicateReferencePackIds.length) {
      statements.push(db.prepare(`
        DELETE FROM "ReferencePack"
        WHERE "userId" = ? AND "id" IN (${duplicateReferencePackIds.map(() => "?").join(", ")})
      `).bind(anonymousUserId, ...duplicateReferencePackIds));
    }
    if (duplicateCharacterIds.length) {
      statements.push(db.prepare(`
        DELETE FROM "ReferencePack"
        WHERE "userId" = ? AND "characterId" IN (${duplicateCharacterIds.map(() => "?").join(", ")})
      `).bind(anonymousUserId, ...duplicateCharacterIds));
      statements.push(db.prepare(`
        DELETE FROM "Character"
        WHERE "userId" = ? AND "id" IN (${duplicateCharacterIds.map(() => "?").join(", ")})
      `).bind(anonymousUserId, ...duplicateCharacterIds));
    }
    if (duplicateAssetIds.length) {
      statements.push(db.prepare(`
        DELETE FROM "Asset"
        WHERE "userId" = ? AND "id" IN (${duplicateAssetIds.map(() => "?").join(", ")})
      `).bind(anonymousUserId, ...duplicateAssetIds));
    }
  }

  for (const table of ["Character", "ReferencePack", "Asset", "GenerationJob", "AlbumItem", "ApiUsageLog"]) {
    statements.push(db.prepare(`UPDATE "${table}" SET "userId" = ? WHERE "userId" = ?`).bind(userId, anonymousUserId));
  }

  statements.push(
    db.prepare('UPDATE "AnonymousIdentity" SET "claimedAt" = ? WHERE "tokenHash" = ?')
      .bind(new Date().toISOString(), tokenHash),
    db.prepare('DELETE FROM "AnonymousGenerationUsage" WHERE "userId" = ?').bind(anonymousUserId),
    db.prepare('DELETE FROM "User" WHERE "id" = ?').bind(anonymousUserId),
  );

  await db.batch(statements);

  cookieStore.delete(ANONYMOUS_COOKIE_NAME);
  redirect(nextPath);
}
