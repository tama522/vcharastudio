import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface VcharaCloudflareEnv extends CloudflareEnv {
  VCHARA_DB?: D1Database;
  VCHARA_ASSETS?: R2Bucket;
  NEXTAUTH_SECRET?: string;
  AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ADMIN_EMAILS?: string;
  ADMIN_USER_IDS?: string;
  ADMIN_ANONYMIZATION_SALT?: string;
  IMAGE_PROVIDER?: string;
  CODEX_WORKER_TOKEN_TTL_DAYS?: string;
}

export async function getCloudflareEnv() {
  const { env } = await getCloudflareContext({ async: true });
  return env as VcharaCloudflareEnv;
}

export async function getVcharaDb() {
  const env = await getCloudflareEnv();
  if (!env.VCHARA_DB) {
    throw new Error("Cloudflare D1 binding VCHARA_DB is not configured.");
  }

  return env.VCHARA_DB;
}

export async function getVcharaAssets() {
  const env = await getCloudflareEnv();
  if (!env.VCHARA_ASSETS) {
    throw new Error("Cloudflare R2 binding VCHARA_ASSETS is not configured.");
  }

  return env.VCHARA_ASSETS;
}

export async function getCloudflareEnvValue(name: keyof VcharaCloudflareEnv) {
  const env = await getCloudflareEnv();
  const value = env[name];
  return typeof value === "string" ? value : undefined;
}
