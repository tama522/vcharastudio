import "server-only";

import { cookies } from "next/headers";
import { base64ToBytes, bytesToBase64, utf8Bytes } from "@/lib/binary";
import { getCloudflareEnvValue } from "@/lib/cloudflare-bindings";
import { timingSafeEqualString } from "@/lib/crypto-web";

export const VCHARA_SESSION_COOKIE = "vchara_session";
export const VCHARA_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface VcharaSessionPayload {
  userId: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  expiresAt: string;
}

function base64UrlEncode(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return base64ToBytes(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

async function sessionSecret() {
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (await getCloudflareEnvValue("NEXTAUTH_SECRET")) ||
    (await getCloudflareEnvValue("AUTH_SECRET"));

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for Vchara session cookies.");
  }

  return secret;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    utf8Bytes(await sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(encodedPayload: string) {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), utf8Bytes(encodedPayload));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSignedSessionToken(payload: VcharaSessionPayload) {
  const encodedPayload = base64UrlEncode(utf8Bytes(JSON.stringify(payload)));
  const signature = await signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySignedSessionToken(token: string | undefined) {
  if (!token) return undefined;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return undefined;

  const expected = await signPayload(encodedPayload);
  if (!timingSafeEqualString(expected, signature)) return undefined;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as VcharaSessionPayload;
    if (!payload.userId || new Date(payload.expiresAt).getTime() <= Date.now()) {
      return undefined;
    }

    return payload;
  } catch {
    return undefined;
  }
}

export async function readSignedSessionCookie() {
  const cookieStore = await cookies();
  return verifySignedSessionToken(cookieStore.get(VCHARA_SESSION_COOKIE)?.value);
}
