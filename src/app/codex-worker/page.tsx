import { CodexWorkerSettings } from "@/components/codex-worker-settings";
import { requireUser } from "@/lib/auth";
import { getCodexWorkerScriptMetadata } from "@/lib/codex-worker-script";
import { listUserCodexWorkers } from "@/lib/user-codex-worker";

export const dynamic = "force-dynamic";

function resolveSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export default async function CodexWorkerPage() {
  const user = await requireUser();
  const [workers, scriptMetadata] = await Promise.all([
    listUserCodexWorkers(user.id),
    getCodexWorkerScriptMetadata(),
  ]);

  return (
    <div className="page-content codex-worker-page">
      <div className="page-title-block">
        <span className="chip chip-sage">After sign-in</span>
        <h1 className="heading-xl">Codex Worker Setup</h1>
        <p className="page-subtitle">
          Create a connection token, then run the generated command in your Mac terminal.
        </p>
      </div>

      <CodexWorkerSettings
        initialWorkers={workers}
        scriptSha256={scriptMetadata.sha256}
        siteUrl={resolveSiteUrl()}
      />
    </div>
  );
}
