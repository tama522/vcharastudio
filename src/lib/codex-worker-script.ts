import "server-only";

import {
  embeddedCodexWorkerScript,
  embeddedCodexWorkerScriptMetadata,
} from "@/generated/codex-worker-script-source";

export function readCodexWorkerScript() {
  return embeddedCodexWorkerScript;
}

export function getCodexWorkerScriptMetadata() {
  return embeddedCodexWorkerScriptMetadata;
}
