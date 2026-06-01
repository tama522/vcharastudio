import { requireAdminUser } from "@/lib/admin";
import { formatBytes, formatUsdFromMicros, getApiUsageDashboard } from "@/lib/api-usage";

export const dynamic = "force-dynamic";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatOptionalDateTime(value?: string, fallback = "Not recorded") {
  return value ? formatDateTime(value) : fallback;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatPercent(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatProviderLabel(provider: string, model?: string) {
  const providerLabel = provider === "user-codex" ? "User Codex" : provider;
  return model ? `${providerLabel} / ${model}` : providerLabel;
}

export default async function AdminUsagePage() {
  await requireAdminUser();
  const dashboard = await getApiUsageDashboard();

  return (
    <div className="page-content">
      <div className="page-title-block">
        <h1 className="heading-xl">Admin</h1>
        <p className="page-subtitle">User lists are anonymized while usage and API costs are shown.</p>
      </div>

      <div className="stats-row admin-stats-row">
        <div className="stat-item">
          <span className="stat-value">{formatInteger(dashboard.userActivity.snapshot.totalUsers)}</span>
          <span className="stat-label">Total Users</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatInteger(dashboard.userActivity.snapshot.activeUsersLast7Days)}</span>
          <span className="stat-label">Users in Last 7 Days</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatInteger(dashboard.userActivity.snapshot.activeSessions)}</span>
          <span className="stat-label">OnSession</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatOptionalDateTime(dashboard.userActivity.snapshot.latestLoginAt)}</span>
          <span className="stat-label">Latest Login</span>
        </div>
        {dashboard.codexGeneration ? (
          <>
            <div className="stat-item">
              <span className="stat-value">{formatInteger(dashboard.codexGeneration.todayImages)}</span>
              <span className="stat-label">Codex Generations Today</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{formatInteger(dashboard.codexGeneration.totalImages)}</span>
              <span className="stat-label">
                {dashboard.codexGeneration.connected ? "Codex Generations Total" : "Codex Generation History"}
              </span>
            </div>
          </>
        ) : null}
      </div>

      <section className="card card-padded stack-md">
        <div className="page-title-row">
          <h2 className="heading-md">Anonymous User Summary</h2>
          <span className="chip chip-soft">Up to 50 items</span>
        </div>
        {dashboard.userActivity.users.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Last Login</th>
                  <th>Last Active</th>
                  <th>Session</th>
                  <th>Generated</th>
                  <th>API</th>
                  <th>Characters</th>
                  <th>Assets</th>
                  <th>Album</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.userActivity.users.map((user) => (
                  <tr key={user.userId}>
                    <td>{user.userLabel}</td>
                    <td>
                      <span className={`chip ${user.accountKind === "anonymous" ? "chip-soft" : "chip-sage"}`}>
                        {user.accountKind === "anonymous" ? "Anonymous" : "Google"}
                      </span>
                    </td>
                    <td>{user.accountKind === "anonymous" ? "N/A" : formatOptionalDateTime(user.lastLoginAt, "Tracked next time")}</td>
                    <td>{formatOptionalDateTime(user.lastActiveAt, "Not used")}</td>
                    <td>{user.activeSessionExpiresAt ? "On" : "-"}</td>
                    <td>{formatInteger(user.generationJobs)}</td>
                    <td>{formatInteger(user.apiCalls)}</td>
                    <td>{formatInteger(user.characters)}</td>
                    <td>{formatInteger(user.assets)}</td>
                    <td>{formatInteger(user.albumItems)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-state-title">No user data yet</p>
            <p className="empty-state-text">Sign-ins or anonymous usage will appear here.</p>
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="card card-padded stack-md">
          <div className="page-title-row">
            <h2 className="heading-md">API Summary</h2>
            <span className="chip chip-soft">30-day basis</span>
          </div>
          <div className="meta-list">
            <div className="meta-row"><span>Calls in Last 24 Hours</span><strong>{formatInteger(dashboard.last24Hours.totalCalls)}</strong></div>
            <div className="meta-row"><span>Success Rate in Last 24 Hours</span><strong>{formatPercent(dashboard.last24Hours.successCalls, dashboard.last24Hours.totalCalls)}</strong></div>
            <div className="meta-row"><span>Estimated Cost in Last 24 Hours</span><strong>{formatUsdFromMicros(dashboard.last24Hours.estimatedCostMicros)}</strong></div>
            <div className="meta-row"><span>Estimated Cost in Last 30 Days</span><strong>{formatUsdFromMicros(dashboard.last30Days.estimatedCostMicros)}</strong></div>
            <div className="meta-row"><span>Total Calls</span><strong>{formatInteger(dashboard.last30Days.totalCalls)}</strong></div>
            <div className="meta-row"><span>Success</span><strong>{formatInteger(dashboard.last30Days.successCalls)}</strong></div>
            <div className="meta-row"><span>Failure</span><strong>{formatInteger(dashboard.last30Days.errorCalls)}</strong></div>
            <div className="meta-row"><span>Input Tokens</span><strong>{formatInteger(dashboard.last30Days.promptTokens)}</strong></div>
            <div className="meta-row"><span>Output Tokens</span><strong>{formatInteger(dashboard.last30Days.candidateTokens)}</strong></div>
            <div className="meta-row"><span>Total Tokens</span><strong>{formatInteger(dashboard.last30Days.totalTokens)}</strong></div>
          </div>
        </section>

        <section className="card card-padded stack-md">
          <div className="page-title-row">
            <h2 className="heading-md">Top API Users</h2>
            <span className="chip chip-sage">By Estimated Cost</span>
          </div>
          {dashboard.topUsers.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Calls</th>
                    <th>Total Tokens</th>
                    <th>Estimated Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.topUsers.map((user) => (
                    <tr key={user.userId}>
                      <td>{user.userLabel}</td>
                      <td>{formatInteger(user.totalCalls)}</td>
                      <td>{formatInteger(user.totalTokens)}</td>
                      <td>{formatUsdFromMicros(user.estimatedCostMicros)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-state-title">No usage logs yet</p>
              <p className="empty-state-text">Provider calls will be summarized here.</p>
            </div>
          )}
        </section>
      </div>

      <section className="card card-padded stack-md">
        <div className="page-title-row">
          <h2 className="heading-md">Daily Trend</h2>
          <span className="chip chip-soft">Last 14 Days</span>
        </div>
        {dashboard.dailySummaries.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Calls</th>
                  <th>Success</th>
                  <th>Failure</th>
                  <th>Total Tokens</th>
                  <th>Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.dailySummaries.map((summary) => (
                  <tr key={summary.date}>
                    <td>{summary.date}</td>
                    <td>{formatInteger(summary.totalCalls)}</td>
                    <td>{formatInteger(summary.successCalls)}</td>
                    <td>{formatInteger(summary.errorCalls)}</td>
                    <td>{formatInteger(summary.totalTokens)}</td>
                    <td>{formatUsdFromMicros(summary.estimatedCostMicros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state-text">No aggregate data for the last 14 days yet.</p>
        )}
      </section>

      <section className="card card-padded stack-md">
        <div className="page-title-row">
          <h2 className="heading-md">Latest Logs</h2>
          <span className="chip chip-soft">Image details hidden</span>
        </div>
        {dashboard.recentLogs.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Operation</th>
                  <th>Type</th>
                  <th>provider</th>
                  <th>Status</th>
                  <th>Prompt</th>
                  <th>Tokens</th>
                  <th>Reference Images</th>
                  <th>Latency</th>
                  <th>Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.userLabel}</td>
                    <td>{log.operationType === "reference-pack" ? "Reference Generation" : "Image Generation"}</td>
                    <td>{log.requestKind}</td>
                    <td>{formatProviderLabel(log.provider, log.model)}</td>
                    <td>
                      <span className={`admin-status-chip ${log.status === "error" ? "is-error" : "is-success"}`}>
                        {log.status === "error" ? "Failure" : "Success"}
                      </span>
                    </td>
                    <td>{formatInteger(log.promptChars)} chars</td>
                    <td>{formatInteger(log.totalTokens ?? 0)}</td>
                    <td>{`${log.sourceImageCount} images / ${formatBytes(log.sourceImageBytes)}`}</td>
                    <td>{`${formatInteger(log.latencyMs)}ms`}</td>
                    <td>{formatUsdFromMicros(log.estimatedCostMicros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-state-title">No logs yet</p>
            <p className="empty-state-text">Rows are added after real provider calls.</p>
          </div>
        )}
      </section>
    </div>
  );
}
