import type { ProviderInfo, RenderProvider } from "@/lib/types";

export const CODEX_RENDER_PROVIDER: RenderProvider = "user-codex";

export function getProviderInfo(): ProviderInfo {
  const requested = process.env.IMAGE_PROVIDER?.trim() || CODEX_RENDER_PROVIDER;
  const message =
    requested === CODEX_RENDER_PROVIDER
      ? "User Codex: Passes generation jobs to each user's local Codex worker."
      : `User Codex: In the Cloudflare edition, IMAGE_PROVIDER=${requested} is ignored and user-codex is used.`;

  return {
    requested,
    resolved: CODEX_RENDER_PROVIDER,
    ready: true,
    message,
  };
}
