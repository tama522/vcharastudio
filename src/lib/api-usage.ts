import "server-only";

import { getVcharaDb } from "@/lib/cloudflare-bindings";
import { createId, simpleStableHash } from "@/lib/crypto-web";
import type {
  AdminUserActivitySummary,
  ApiUsageDashboardPayload,
  ApiUsageDashboardSnapshot,
  ApiUsageLogEntry,
  ApiUsageOperationType,
  ApiUsageStatus,
} from "@/lib/types";

interface RecordApiUsageInput {
  userId: string;
  generationJobId?: string;
  characterId?: string;
  provider: string;
  model?: string;
  operationType: ApiUsageOperationType;
  requestKind: string;
  status: ApiUsageStatus;
  failureReason?: string;
  promptChars: number;
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
  sourceImageCount: number;
  sourceImageBytes: number;
  responseImageCount: number;
  latencyMs: number;
  estimatedCostMicros?: number;
}

const MICROS_PER_USD = 1_000_000;
const USER_ACTIVITY_LIMIT = 50;
const TOKYO_TIME_ZONE = "Asia/Tokyo";

function numberOrZero(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildAnonymizedUserLabel(userId: string) {
  const salt =
    process.env.ADMIN_ANONYMIZATION_SALT ??
    process.env.NEXTAUTH_SECRET ??
    "vcharastudio-admin-usage";
  const digest = simpleStableHash(`${salt}:${userId}`);

  return `User-${digest}`;
}

function toDate(value: unknown) {
  if (!value) return undefined;
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: unknown) {
  return toDate(value)?.toISOString();
}

function maxDate(...values: unknown[]) {
  return values.reduce<Date | undefined>((latest, value) => {
    const date = toDate(value);
    if (!date) return latest;
    if (!latest || date.getTime() > latest.getTime()) return date;
    return latest;
  }, undefined);
}

function dateKeyInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return `${lookup.get("year")}-${lookup.get("month")}-${lookup.get("day")}`;
}

function startOfTodayInTokyo(now: Date) {
  return new Date(`${dateKeyInTimeZone(now, TOKYO_TIME_ZONE)}T00:00:00+09:00`);
}

export async function recordApiUsageLog(input: RecordApiUsageInput) {
  const db = await getVcharaDb();
  await db.prepare(`
    INSERT INTO "ApiUsageLog" (
      "id", "userId", "generationJobId", "characterId", "provider", "model",
      "operationType", "requestKind", "status", "failureReason", "promptChars",
      "promptTokens", "candidateTokens", "totalTokens", "sourceImageCount",
      "sourceImageBytes", "responseImageCount", "latencyMs", "estimatedCostMicros", "createdAt"
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    createId("usage"),
    input.userId,
    input.generationJobId ?? null,
    input.characterId ?? null,
    input.provider,
    input.model ?? null,
    input.operationType,
    input.requestKind,
    input.status,
    input.failureReason ?? null,
    input.promptChars,
    input.promptTokens ?? null,
    input.candidateTokens ?? null,
    input.totalTokens ?? null,
    input.sourceImageCount,
    input.sourceImageBytes,
    input.responseImageCount,
    input.latencyMs,
    input.estimatedCostMicros ?? null,
    new Date().toISOString(),
  ).run();
}

function buildSnapshot(logs: Array<Pick<ApiUsageLogEntry,
  "status" | "promptTokens" | "candidateTokens" | "totalTokens" | "estimatedCostMicros"
>>) : ApiUsageDashboardSnapshot {
  return logs.reduce<ApiUsageDashboardSnapshot>((acc, log) => {
    acc.totalCalls += 1;
    if (log.status === "success") {
      acc.successCalls += 1;
    } else {
      acc.errorCalls += 1;
    }
    acc.promptTokens += numberOrZero(log.promptTokens);
    acc.candidateTokens += numberOrZero(log.candidateTokens);
    acc.totalTokens += numberOrZero(log.totalTokens);
    acc.estimatedCostMicros += numberOrZero(log.estimatedCostMicros);
    return acc;
  }, {
    totalCalls: 0,
    successCalls: 0,
    errorCalls: 0,
    promptTokens: 0,
    candidateTokens: 0,
    totalTokens: 0,
    estimatedCostMicros: 0,
  });
}

export function formatUsdFromMicros(value?: number | null) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(numberOrZero(value) / MICROS_PER_USD);
}

export function formatBytes(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${value} B`;
}

export async function getApiUsageDashboard(): Promise<ApiUsageDashboardPayload> {
  const db = await getVcharaDb();
  const now = new Date();
  const last24HoursStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7DaysStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30DaysStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = startOfTodayInTokyo(now);
  const connectedWorkerSince = new Date(now.getTime() - 2 * 60 * 1000);

  const [
    recentLogs,
    last30DaysLogs,
    last24HoursLogs,
    users,
    codexTotalImages,
    codexTodayImages,
    connectedUserCodexWorkers,
  ] = await Promise.all([
    db.prepare('SELECT * FROM "ApiUsageLog" ORDER BY "createdAt" DESC LIMIT 100').all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM "ApiUsageLog" WHERE "createdAt" >= ? ORDER BY "createdAt" DESC')
      .bind(last30DaysStart.toISOString())
      .all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM "ApiUsageLog" WHERE "createdAt" >= ? ORDER BY "createdAt" DESC')
      .bind(last24HoursStart.toISOString())
      .all<Record<string, unknown>>(),
    db.prepare(`
      SELECT
        u."id",
        u."isAnonymous",
        u."lastLoginAt",
        (SELECT MAX(s."expires") FROM "Session" s WHERE s."userId" = u."id") AS "latestSessionExpiresAt",
        (SELECT MAX(j."updatedAt") FROM "GenerationJob" j WHERE j."userId" = u."id") AS "latestJobUpdatedAt",
        (SELECT MAX(j."createdAt") FROM "GenerationJob" j WHERE j."userId" = u."id") AS "latestJobCreatedAt",
        (SELECT MAX(l."createdAt") FROM "ApiUsageLog" l WHERE l."userId" = u."id") AS "latestApiUsageAt",
        (SELECT MAX(a."createdAt") FROM "Asset" a WHERE a."userId" = u."id") AS "latestAssetAt",
        (SELECT MAX(c."createdAt") FROM "Character" c WHERE c."userId" = u."id") AS "latestCharacterAt",
        (SELECT MAX(ai."createdAt") FROM "AlbumItem" ai WHERE ai."userId" = u."id") AS "latestAlbumItemAt",
        (SELECT COUNT(*) FROM "Session" s WHERE s."userId" = u."id") AS "sessionsCount",
        (SELECT COUNT(*) FROM "GenerationJob" j WHERE j."userId" = u."id") AS "generationJobsCount",
        (SELECT COUNT(*) FROM "ApiUsageLog" l WHERE l."userId" = u."id") AS "apiUsageLogsCount",
        (SELECT COUNT(*) FROM "Character" c WHERE c."userId" = u."id") AS "charactersCount",
        (SELECT COUNT(*) FROM "Asset" a WHERE a."userId" = u."id") AS "assetsCount",
        (SELECT COUNT(*) FROM "AlbumItem" ai WHERE ai."userId" = u."id") AS "albumItemsCount"
      FROM "User" u
    `).all<Record<string, unknown>>(),
    db.prepare(`
      SELECT COUNT(*) AS "count"
      FROM "GenerationJob"
      WHERE "provider" = 'user-codex' AND "status" = 'completed'
    `).first<{ count: number }>(),
    db.prepare(`
      SELECT COUNT(*) AS "count"
      FROM "GenerationJob"
      WHERE "provider" = 'user-codex'
        AND "status" = 'completed'
        AND "updatedAt" >= ?
    `).bind(todayStart.toISOString()).first<{ count: number }>(),
    db.prepare(`
      SELECT COUNT(*) AS "count"
      FROM "CodexWorker"
      WHERE "revokedAt" IS NULL
        AND "expiresAt" > ?
        AND "lastSeenAt" >= ?
    `).bind(now.toISOString(), connectedWorkerSince.toISOString()).first<{ count: number }>(),
  ]);

  const recentLogRows = recentLogs.results ?? [];
  const last30Rows = last30DaysLogs.results ?? [];
  const last24Rows = last24HoursLogs.results ?? [];
  const userRows = users.results ?? [];

  const recentLogEntries: ApiUsageLogEntry[] = recentLogRows.map((log) => ({
    id: String(log.id),
    createdAt: toIso(log.createdAt) ?? new Date(0).toISOString(),
    userId: String(log.userId),
    userLabel: buildAnonymizedUserLabel(String(log.userId)),
    generationJobId: typeof log.generationJobId === "string" ? log.generationJobId : undefined,
    characterId: typeof log.characterId === "string" ? log.characterId : undefined,
    provider: String(log.provider),
    model: typeof log.model === "string" ? log.model : undefined,
    operationType: log.operationType === "reference-pack" ? "reference-pack" : "generation",
    requestKind: String(log.requestKind),
    status: log.status === "error" ? "error" : "success",
    failureReason: typeof log.failureReason === "string" ? log.failureReason : undefined,
    promptChars: Number(log.promptChars) || 0,
    promptTokens: log.promptTokens == null ? undefined : Number(log.promptTokens),
    candidateTokens: log.candidateTokens == null ? undefined : Number(log.candidateTokens),
    totalTokens: log.totalTokens == null ? undefined : Number(log.totalTokens),
    sourceImageCount: Number(log.sourceImageCount) || 0,
    sourceImageBytes: Number(log.sourceImageBytes) || 0,
    responseImageCount: Number(log.responseImageCount) || 0,
    latencyMs: Number(log.latencyMs) || 0,
    estimatedCostMicros: log.estimatedCostMicros == null ? undefined : Number(log.estimatedCostMicros),
  }));

  const last30Entries = last30Rows.map((log) => ({
    status: log.status === "error" ? "error" as const : "success" as const,
    promptTokens: log.promptTokens == null ? undefined : Number(log.promptTokens),
    candidateTokens: log.candidateTokens == null ? undefined : Number(log.candidateTokens),
    totalTokens: log.totalTokens == null ? undefined : Number(log.totalTokens),
    estimatedCostMicros: log.estimatedCostMicros == null ? undefined : Number(log.estimatedCostMicros),
  }));
  const last24Entries = last24Rows.map((log) => ({
    status: log.status === "error" ? "error" as const : "success" as const,
    promptTokens: log.promptTokens == null ? undefined : Number(log.promptTokens),
    candidateTokens: log.candidateTokens == null ? undefined : Number(log.candidateTokens),
    totalTokens: log.totalTokens == null ? undefined : Number(log.totalTokens),
    estimatedCostMicros: log.estimatedCostMicros == null ? undefined : Number(log.estimatedCostMicros),
  }));

  const dailyMap = new Map<string, ApiUsageDashboardPayload["dailySummaries"][number]>();
  const userMap = new Map<string, ApiUsageDashboardPayload["topUsers"][number]>();

  for (const log of last30Rows) {
    const date = (toIso(log.createdAt) ?? new Date(0).toISOString()).slice(0, 10);
    const daily = dailyMap.get(date) ?? {
      date,
      totalCalls: 0,
      successCalls: 0,
      errorCalls: 0,
      promptTokens: 0,
      candidateTokens: 0,
      totalTokens: 0,
      estimatedCostMicros: 0,
    };
    daily.totalCalls += 1;
    if (log.status === "error") {
      daily.errorCalls += 1;
    } else {
      daily.successCalls += 1;
    }
    daily.promptTokens += numberOrZero(Number(log.promptTokens));
    daily.candidateTokens += numberOrZero(Number(log.candidateTokens));
    daily.totalTokens += numberOrZero(Number(log.totalTokens));
    daily.estimatedCostMicros += numberOrZero(Number(log.estimatedCostMicros));
    dailyMap.set(date, daily);

    const userId = String(log.userId);
    const userLabel = buildAnonymizedUserLabel(userId);
    const userSummary = userMap.get(userId) ?? {
      userId,
      userLabel,
      totalCalls: 0,
      successCalls: 0,
      errorCalls: 0,
      totalTokens: 0,
      estimatedCostMicros: 0,
    };
    userSummary.totalCalls += 1;
    if (log.status === "error") {
      userSummary.errorCalls += 1;
    } else {
      userSummary.successCalls += 1;
    }
    userSummary.totalTokens += numberOrZero(Number(log.totalTokens));
    userSummary.estimatedCostMicros += numberOrZero(Number(log.estimatedCostMicros));
    userMap.set(userId, userSummary);
  }

  const userActivityRows: AdminUserActivitySummary[] = userRows.map((user) => {
    const lastActiveAt = maxDate(
      user.lastLoginAt,
      user.latestJobUpdatedAt,
      user.latestJobCreatedAt,
      user.latestApiUsageAt,
      user.latestAssetAt,
      user.latestCharacterAt,
      user.latestAlbumItemAt,
    );
    const latestSession = toDate(user.latestSessionExpiresAt);
    const userId = String(user.id);

    return {
      userId,
      userLabel: buildAnonymizedUserLabel(userId),
      accountKind: Number(user.isAnonymous) ? "anonymous" : "signed-in",
      lastLoginAt: toIso(user.lastLoginAt),
      lastActiveAt: toIso(lastActiveAt),
      activeSessionExpiresAt: latestSession && latestSession > now ? toIso(latestSession) : undefined,
      generationJobs: Number(user.generationJobsCount) || 0,
      apiCalls: Number(user.apiUsageLogsCount) || 0,
      characters: Number(user.charactersCount) || 0,
      assets: Number(user.assetsCount) || 0,
      albumItems: Number(user.albumItemsCount) || 0,
    };
  });
  const sortedUserActivityRows = userActivityRows
    .sort((a, b) => {
      const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      return bTime - aTime || b.generationJobs - a.generationJobs || b.apiCalls - a.apiCalls;
    })
    .slice(0, USER_ACTIVITY_LIMIT);

  return {
    last24Hours: buildSnapshot(last24Entries),
    last30Days: buildSnapshot(last30Entries),
    recentLogs: recentLogEntries,
    dailySummaries: [...dailyMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14),
    topUsers: [...userMap.values()]
      .sort((a, b) => b.estimatedCostMicros - a.estimatedCostMicros || b.totalCalls - a.totalCalls)
      .slice(0, 12),
    userActivity: {
      snapshot: {
        totalUsers: userRows.length,
        signedInUsers: userRows.filter((user) => !Number(user.isAnonymous)).length,
        anonymousUsers: userRows.filter((user) => Number(user.isAnonymous)).length,
        activeUsersLast7Days: userActivityRows.filter((user) => {
          if (!user.lastActiveAt) return false;
          return new Date(user.lastActiveAt).getTime() >= last7DaysStart.getTime();
        }).length,
        activeSessions: userActivityRows.filter((user) => Boolean(user.activeSessionExpiresAt)).length,
        latestLoginAt: toIso(maxDate(...userRows.map((user) => user.lastLoginAt))),
      },
      users: sortedUserActivityRows,
    },
    codexGeneration: Number(connectedUserCodexWorkers?.count) > 0 || Number(codexTotalImages?.count) > 0
      ? {
          connected: Number(connectedUserCodexWorkers?.count) > 0,
          todayImages: Number(codexTodayImages?.count) || 0,
          totalImages: Number(codexTotalImages?.count) || 0,
        }
      : undefined,
  };
}
