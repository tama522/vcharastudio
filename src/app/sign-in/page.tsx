import { redirect } from "next/navigation";
import { GoogleSignInButton, LocalDevSignInButton } from "@/components/auth-buttons";
import { auth, isGoogleAuthConfigured, isLocalDevAuthEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SignInSearchParams = {
  callbackUrl?: string;
  devSecret?: string;
  error?: string;
};

const DEFAULT_SIGN_IN_CALLBACK = "/codex-worker";

function safeCallbackUrl(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return DEFAULT_SIGN_IN_CALLBACK;
  if (value === "/sign-in" || value.startsWith("/sign-in?")) return DEFAULT_SIGN_IN_CALLBACK;
  if (value.startsWith("/api/auth")) return DEFAULT_SIGN_IN_CALLBACK;
  return value;
}

function shouldCleanSignInUrl(params: SignInSearchParams, callbackUrl: string) {
  return params.error === "OAuthCallback" || Boolean(params.callbackUrl && params.callbackUrl !== callbackUrl);
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SignInSearchParams>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  if (shouldCleanSignInUrl(params, callbackUrl)) {
    redirect("/sign-in");
  }

  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  const googleConfigured = isGoogleAuthConfigured();
  const localDevEnabled = isLocalDevAuthEnabled();

  return (
    <div className="page-content">
      <div className="page-title-block">
        <span className="chip chip-sage">Codex edition</span>
        <h1 className="heading-xl">Sign in</h1>
        <p className="page-subtitle">
          Image generation runs through a Codex worker connected to your own account.
        </p>
      </div>

      <section className="surface-card sign-in-card">
        <h2 className="heading-md">Start with Google</h2>
        <p className="surface-copy">
          Use Google OAuth for sign-in. After signing in, you will continue to your private workspace.
        </p>
        <div className="sign-in-actions">
          <GoogleSignInButton callbackUrl={callbackUrl} disabled={!googleConfigured} />
        </div>
        {googleConfigured ? null : (
          <p className="form-helper">
            GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured yet.
          </p>
        )}
      </section>

      {localDevEnabled ? (
        <section className="surface-card sign-in-card">
          <h2 className="heading-md">Local development sign-in</h2>
          <p className="surface-copy">
            Use a fixed development user for local or LAN testing without adding Google OAuth redirect URIs.
          </p>
          <div className="sign-in-actions">
            <LocalDevSignInButton callbackUrl={callbackUrl} devSecret={params.devSecret} />
          </div>
          <p className="form-helper">
            This is disabled in production builds. Use it only for local verification.
          </p>
        </section>
      ) : null}
    </div>
  );
}
