import { NextResponse, type NextRequest } from "next/server";
import { getLocalDevUserProfile, isLocalDevAuthEnabled } from "@/lib/auth";
import { timingSafeEqualString } from "@/lib/crypto-web";
import { seedDefaultCharactersForUser } from "@/lib/app-repository";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  createSignedSessionToken,
  VCHARA_SESSION_COOKIE,
  VCHARA_SESSION_MAX_AGE_SECONDS,
} from "@/lib/session-cookie";
import { upsertSignedInUser } from "@/lib/user-repository";

export const dynamic = "force-dynamic";

const DEFAULT_SIGN_IN_CALLBACK = "/codex-worker";

function safeCallbackUrl(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return DEFAULT_SIGN_IN_CALLBACK;
  if (value === "/sign-in" || value.startsWith("/sign-in?")) return DEFAULT_SIGN_IN_CALLBACK;
  if (value.startsWith("/api/auth")) return DEFAULT_SIGN_IN_CALLBACK;
  return value;
}

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function sessionCookieName() {
  return VCHARA_SESSION_COOKIE;
}

function redirectOrigin(request: NextRequest) {
  const host = request.headers.get("host");
  if (!host) return request.nextUrl.origin;

  const redirectHost = host.replace(/^0\.0\.0\.0(?::|$)/, (match) => match.replace("0.0.0.0", "localhost"));
  return `${isSecureRequest(request) ? "https" : "http"}://${redirectHost}`;
}

function hostWithoutPort(value: string | null) {
  if (!value) return "";
  if (value.startsWith("[")) return value.slice(1, value.indexOf("]"));
  return value.split(":")[0] ?? "";
}

function isLoopbackHost(request: NextRequest) {
  const host = hostWithoutPort(request.headers.get("host")).toLowerCase();
  return host === "localhost" || host === "::1" || host.startsWith("127.");
}

function safeEqual(a: string, b: string) {
  return timingSafeEqualString(a, b);
}

function isAllowedLocalDevRequest(request: NextRequest) {
  if (isLoopbackHost(request)) return true;

  const secret = process.env.LOCAL_DEV_AUTH_SECRET?.trim();
  if (!secret) return false;

  const requestSecret =
    request.nextUrl.searchParams.get("devSecret") ||
    request.headers.get("x-vchara-local-dev-secret") ||
    "";

  return safeEqual(requestSecret, secret);
}

export async function GET(request: NextRequest) {
  if (!isLocalDevAuthEnabled()) {
    return Response.json({ message: "Local development sign-in is disabled." }, { status: 404 });
  }

  const rateLimit = checkRequestRateLimit(request, "local-dev-sign-in", {
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  if (!isAllowedLocalDevRequest(request)) {
    return Response.json(
      { message: "Local development sign-in requires LOCAL_DEV_AUTH_SECRET from non-loopback hosts." },
      { status: 403 },
    );
  }

  const profile = getLocalDevUserProfile();
  const now = new Date();
  const user = await upsertSignedInUser({
    email: profile.email,
    name: profile.name,
    emailVerified: now,
  });

  await seedDefaultCharactersForUser(user.id);

  const expires = new Date(now.getTime() + VCHARA_SESSION_MAX_AGE_SECONDS * 1000);
  const sessionToken = await createSignedSessionToken({
    userId: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    expiresAt: expires.toISOString(),
  });

  const callbackUrl = safeCallbackUrl(request.nextUrl.searchParams.get("callbackUrl"));
  const response = NextResponse.redirect(new URL(callbackUrl, redirectOrigin(request)));
  response.cookies.set({
    name: sessionCookieName(),
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    expires,
    maxAge: VCHARA_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
