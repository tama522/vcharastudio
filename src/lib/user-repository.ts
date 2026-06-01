import "server-only";

import { getVcharaDb } from "@/lib/cloudflare-bindings";
import { createId } from "@/lib/crypto-web";

export interface UserRecord {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAnonymous: boolean;
}

function toUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : null,
    email: typeof row.email === "string" ? row.email : null,
    image: typeof row.image === "string" ? row.image : null,
    isAnonymous: row.isAnonymous === 1 || row.isAnonymous === true || row.isAnonymous === "1",
  };
}

export async function findUserById(userId: string) {
  const db = await getVcharaDb();
  const row = await db.prepare('SELECT * FROM "User" WHERE "id" = ? LIMIT 1').bind(userId).first<Record<string, unknown>>();
  return row ? toUser(row) : undefined;
}

export async function findUserByEmail(email: string) {
  const db = await getVcharaDb();
  const row = await db.prepare('SELECT * FROM "User" WHERE "email" = ? LIMIT 1').bind(email).first<Record<string, unknown>>();
  return row ? toUser(row) : undefined;
}

export async function upsertSignedInUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: string | Date | null;
}) {
  const db = await getVcharaDb();
  const existing = await findUserByEmail(input.email);
  const now = new Date().toISOString();
  const emailVerified =
    input.emailVerified instanceof Date ? input.emailVerified.toISOString() : input.emailVerified ?? now;

  if (existing) {
    await db.prepare(`
      UPDATE "User"
      SET "name" = ?, "image" = ?, "emailVerified" = ?, "isAnonymous" = 0, "lastLoginAt" = ?
      WHERE "id" = ?
    `).bind(input.name ?? existing.name ?? null, input.image ?? existing.image ?? null, emailVerified, now, existing.id).run();
    return {
      ...existing,
      name: input.name ?? existing.name,
      image: input.image ?? existing.image,
      isAnonymous: false,
    };
  }

  const user: UserRecord = {
    id: createId("user"),
    name: input.name ?? null,
    email: input.email,
    image: input.image ?? null,
    isAnonymous: false,
  };

  await db.prepare(`
    INSERT INTO "User" (
      "id", "name", "email", "emailVerified", "image", "isAnonymous", "lastLoginAt"
    )
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).bind(user.id, user.name ?? null, user.email, emailVerified, user.image ?? null, now).run();

  return user;
}

export async function createAnonymousUser(tokenHash: string) {
  const db = await getVcharaDb();
  const now = new Date().toISOString();
  const user: UserRecord = {
    id: createId("anon"),
    name: "Anonymous User",
    email: null,
    image: null,
    isAnonymous: true,
  };

  await db.batch([
    db.prepare(`
      INSERT INTO "User" (
        "id", "name", "email", "emailVerified", "image", "isAnonymous", "lastLoginAt"
      )
      VALUES (?, ?, NULL, NULL, NULL, 1, NULL)
    `).bind(user.id, user.name),
    db.prepare(`
      INSERT INTO "AnonymousIdentity" ("id", "tokenHash", "userId", "createdAt", "claimedAt")
      VALUES (?, ?, ?, ?, NULL)
    `).bind(createId("anon_ident"), tokenHash, user.id, now),
  ]);

  return user;
}

export async function touchUserLastLogin(userId: string) {
  const db = await getVcharaDb();
  await db.prepare('UPDATE "User" SET "lastLoginAt" = ? WHERE "id" = ?')
    .bind(new Date().toISOString(), userId)
    .run();
}
