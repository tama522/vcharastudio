"use client";

import { signIn, signOut } from "next-auth/react";

export function GoogleSignInButton({
  callbackUrl = "/codex-worker",
  disabled,
}: {
  callbackUrl?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="btn btn-primary"
      disabled={disabled}
      type="button"
      onClick={() => void signIn("google", { callbackUrl })}
    >
      Sign in with Google
    </button>
  );
}

export function LocalDevSignInButton({
  callbackUrl = "/codex-worker",
  devSecret,
}: {
  callbackUrl?: string;
  devSecret?: string;
}) {
  const params = new URLSearchParams({ callbackUrl });
  if (devSecret) params.set("devSecret", devSecret);
  const href = `/api/local-dev/sign-in?${params.toString()}`;

  return (
    <button
      className="btn btn-secondary"
      type="button"
      onClick={() => {
        window.location.href = href;
      }}
    >
      Sign in as Local Dev User
    </button>
  );
}

export function SignOutButton() {
  return (
    <button
      className="btn btn-secondary btn-sm"
      type="button"
      onClick={() => void signOut({ callbackUrl: "/sign-in" })}
    >
      Sign Out
    </button>
  );
}
