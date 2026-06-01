"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { CodexWorkerSummary, CodexWorkerTokenCreateResult } from "@/lib/types";

type Feedback =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

function formatDateTime(value?: string) {
  if (!value) return "Not connected";

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function formatExpiry(value?: string) {
  return value ? formatDateTime(value) : "No expiration";
}

function buildLaunchCommand(siteUrl: string, token: string, scriptSha256: string) {
  const scriptUrl = `${siteUrl.replace(/\/$/, "")}/api/codex-worker/script`;
  const checksumLine = `${scriptSha256}  vchara-codex-worker.mjs`;

  return [
    `curl -fsSL ${shellQuote(scriptUrl)} -o vchara-codex-worker.mjs`,
    `printf '%s\\n' ${shellQuote(checksumLine)} | shasum -a 256 -c -`,
    `VCHARA_SITE_URL=${shellQuote(siteUrl)} \\`,
    `VCHARA_CODEX_WORKER_TOKEN=${shellQuote(token)} \\`,
    "node vchara-codex-worker.mjs",
  ].join("\n");
}

export function CodexWorkerSettings({
  initialWorkers,
  scriptSha256,
  siteUrl,
}: {
  initialWorkers: CodexWorkerSummary[];
  scriptSha256: string;
  siteUrl: string;
}) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [name, setName] = useState("My Mac");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const placeholderChecksumLine = `${scriptSha256}  vchara-codex-worker.mjs`;
  const launchCommand = createdToken
    ? buildLaunchCommand(siteUrl, createdToken, scriptSha256)
    : [
        `curl -fsSL ${shellQuote(`${siteUrl.replace(/\/$/, "")}/api/codex-worker/script`)} -o vchara-codex-worker.mjs`,
        `printf '%s\\n' ${shellQuote(placeholderChecksumLine)} | shasum -a 256 -c -`,
        `VCHARA_SITE_URL=${shellQuote(siteUrl)} \\`,
        "VCHARA_CODEX_WORKER_TOKEN=paste-api-key-here \\",
        "node vchara-codex-worker.mjs",
      ].join("\n");

  async function refreshWorkers() {
    const response = await fetch("/api/codex-worker/tokens", { cache: "no-store" });
    if (!response.ok) return;

    const payload = (await response.json()) as { workers?: CodexWorkerSummary[] };
    setWorkers(payload.workers ?? []);
  }

  async function createWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/codex-worker/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as
        | CodexWorkerTokenCreateResult
        | { message?: string }
        | null;

      if (!response.ok || !payload || !("token" in payload)) {
        setFeedback({
          type: "error",
          message: payload && "message" in payload && payload.message ? payload.message : "Could not create the token.",
        });
        return;
      }

      setCreatedToken(payload.token);
      setWorkers((current) => [payload.worker, ...current]);
      setFeedback({
        type: "success",
        message: "Token created. It will not be shown again after you leave this screen.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "A network error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function revokeWorker(workerId: string) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/codex-worker/tokens/${encodeURIComponent(workerId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setFeedback({
          type: "error",
          message: payload?.message ?? "Could not revoke the connection.",
        });
        return;
      }

      await refreshWorkers();
      setCreatedToken(null);
      setFeedback({
        type: "success",
        message: "Connection revoked.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "A network error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard?.writeText(createdToken).catch(() => undefined);
  }

  async function copyLaunchCommand() {
    await navigator.clipboard?.writeText(launchCommand).catch(() => undefined);
  }

  return (
    <div className="codex-worker-grid">
      <section className="card card-padded codex-worker-panel codex-worker-steps" aria-labelledby="codex-worker-method-title">
        <div className="page-title-row">
          <div>
            <h2 id="codex-worker-method-title" className="heading-md">Your Connection Method</h2>
            <p className="page-subtitle">
              Create a token, copy the launch command, run it on your Mac, and verify the connection here.
            </p>
          </div>
        </div>
        <ol className="codex-worker-step-list">
          <li className="codex-worker-step">
            <span>1</span>
            <strong>Name the device</strong>
            <p>Enter a recognizable name for your Mac when creating the connection token.</p>
          </li>
          <li className="codex-worker-step">
            <span>2</span>
            <strong>Create API Key</strong>
            <p>The API key is shown only once and personalizes the launch command.</p>
          </li>
          <li className="codex-worker-step">
            <span>3</span>
            <strong>Start on Mac</strong>
            <p>Copy the command with the key and paste it into Terminal on your Mac.</p>
          </li>
          <li className="codex-worker-step">
            <span>4</span>
            <strong>Run Generation</strong>
            <p>When the registered connection is online, it can receive image generation jobs.</p>
          </li>
        </ol>
      </section>

      <section className="card card-padded codex-worker-panel">
        <div className="page-title-row">
          <div>
            <h2 className="heading-md">Connection Token</h2>
            <p className="page-subtitle">Only your Mac can fetch generation jobs for this account</p>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={refreshWorkers}>
            Refresh
          </button>
        </div>
        <form className="codex-worker-form" onSubmit={createWorker}>
          <label className="field-label" htmlFor="codex-worker-name">Device Name</label>
          <div className="codex-worker-form-row">
            <input
              id="codex-worker-name"
              className="input"
              maxLength={48}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="btn btn-primary" disabled={isSubmitting} type="submit">
              Create
            </button>
          </div>
        </form>
        {createdToken ? (
          <div className="codex-worker-token">
            <div className="codex-worker-token-head">
              <strong>Worker API Key</strong>
              <button className="btn btn-secondary btn-sm" type="button" onClick={copyToken}>
                Copy API Key
              </button>
            </div>
            <code>{createdToken}</code>
            <p className="codex-worker-security-note">
              This API key can access generation jobs and reference images. Do not share it, and revoke it when no longer needed.
            </p>
          </div>
        ) : null}
        <p className={`codex-worker-feedback ${feedback ? `is-${feedback.type}` : ""}`}>
          {feedback?.message ?? "The token is shown only immediately after creation."}
        </p>
      </section>

      <section className="card card-padded codex-worker-panel">
        <h2 className="heading-md">Registered Connections</h2>
        <div className="codex-worker-list">
          {workers.length ? (
            workers.map((worker) => (
              <div className="codex-worker-item" key={worker.id}>
                <div>
                  <strong>{worker.name}</strong>
                  <span>
                    {worker.revokedAt ? "Revoked" : worker.expired ? "Expired" : worker.connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <div className="codex-worker-item-meta">
                  <span>Last seen {formatDateTime(worker.lastSeenAt)}</span>
                  <span>Expires {formatExpiry(worker.expiresAt)}</span>
                  {!worker.revokedAt ? (
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={isSubmitting}
                      type="button"
                      onClick={() => revokeWorker(worker.id)}
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">No connection tokens yet.</p>
          )}
        </div>
      </section>

      <section className="card card-padded codex-worker-panel codex-worker-command">
        <div className="page-title-row">
          <div>
            <h2 className="heading-md">Mac Launch Command</h2>
            <p className="page-subtitle">
              {createdToken ? "Paste this command into Terminal on your Mac to start the worker." : "After creating an API key, your personalized command will be shown here."}
            </p>
          </div>
          <div className="codex-worker-command-actions">
            <button className="btn btn-primary btn-sm" disabled={!createdToken} type="button" onClick={copyLaunchCommand}>
              Copy Launch Command
            </button>
            <a className="btn btn-secondary btn-sm" download href="/api/codex-worker/script">
              Download mjs
            </a>
          </div>
        </div>
        <div className="codex-worker-checksum">
          <span>script sha256</span>
          <code>{scriptSha256}</code>
        </div>
        <pre>{launchCommand}</pre>
      </section>
    </div>
  );
}
