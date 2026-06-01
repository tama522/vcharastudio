#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const siteUrl = (process.env.VCHARA_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const token = process.env.VCHARA_CODEX_WORKER_TOKEN;
const codexCliPath = process.env.LOCAL_CODEX_CLI_PATH || "/Applications/Codex.app/Contents/Resources/codex";
const model = process.env.LOCAL_CODEX_MODEL || process.env.CODEX_MODEL || "gpt-5.5";
const effort = process.env.LOCAL_CODEX_REASONING_EFFORT || "low";
const pollMs = positiveNumber(process.env.VCHARA_CODEX_WORKER_POLL_MS, 5000);
const timeoutMs = positiveNumber(process.env.LOCAL_CODEX_TIMEOUT_MS, 300000);

if (!token) {
  console.error("VCHARA_CODEX_WORKER_TOKEN is required.");
  process.exit(1);
}

if (codexCliPath.includes("/") && !existsSync(codexCliPath)) {
  console.error(`Codex CLI was not found: ${codexCliPath}`);
  process.exit(1);
}

let shouldStop = false;
process.on("SIGINT", () => {
  shouldStop = true;
});
process.on("SIGTERM", () => {
  shouldStop = true;
});

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedString(value, path) {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
}

function toErrorMessage(value) {
  if (!isRecord(value)) return "Codex app-server request failed.";
  const error = value.error;
  if (!isRecord(error)) return "Codex app-server request failed.";
  return typeof error.message === "string" ? error.message : "Codex app-server request failed.";
}

async function api(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }

  return payload;
}

function sourceRoleBoundary(source, index) {
  const label = String(source.label || `Image ${index + 1}`).trim();
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("background")) {
    return `Image ${index + 1} (${label}): background scene reference only. Use it for scene layout, perspective, lighting, and compositing context. Do not copy or infer the character pose from this image.`;
  }

  if (normalizedLabel.includes("reference") || normalizedLabel.includes("consistency")) {
    return `Image ${index + 1} (${label}): character identity/style reference only. Reproduce the character likeness strongly: face, hair, outfit cues, colors, body proportions, and overall identity. Do not copy its pose, limb placement, body angle, framing, or camera distance unless the text prompt explicitly asks for the same pose.`;
  }

  return `Image ${index + 1} (${label}): use only for its requested visual role. Text instructions override any pose, framing, or body staging visible in this image.`;
}

function buildPrompt(job) {
  const sourceSummary = job.sourceImages?.length
    ? "Input images are attached after this prompt. Follow the role boundaries below for each image."
    : "No input images are attached. Generate from the text prompt only.";
  const roleInstructions = job.sourceImages?.length
    ? ["Input image role boundaries:", ...job.sourceImages.map(sourceRoleBoundary)].join("\n")
    : undefined;
  const poseInstructions = job.posePriority
    ? [
        "Pose priority mode:",
        "The text prompt's pose and body-posture instructions are the source of truth.",
        "If an input image shows a different pose, ignore that pose and redraw the body staging to match the text prompt.",
        "Do not keep arms, legs, torso angle, head tilt, camera distance, or framing from input images when they conflict with the requested pose.",
        "Preserve character identity and the requested background while changing the pose.",
      ].join("\n")
    : undefined;
  const finalPoseInstructions = job.posePriority
    ? [
        "Final Codex pose directive:",
        "Keep the photographed/reference character identity as the visual source: face, hair, outfit cues, signature colors, body proportions, and overall character likeness.",
        "Use the text pose, body posture, camera distance, framing, and placement as the body staging target.",
        "Redraw body orientation, torso angle, limb placement, head tilt, and camera distance when the reference image conflicts with the requested staging.",
      ].join("\n")
    : undefined;

  return [
    "Generate exactly one raster image for vchara.",
    "Use image generation. Do not run shell commands, browse the web, edit files, or write local project files.",
    "After the image is generated, keep any final text to a short completion note.",
    `Title: ${job.title}`,
    job.subtitle ? `Subtitle: ${job.subtitle}` : undefined,
    `Target canvas: ${job.width}x${job.height}.`,
    sourceSummary,
    roleInstructions,
    poseInstructions,
    "Prompt:",
    job.prompt,
    finalPoseInstructions,
  ].filter(Boolean).join("\n");
}

function imageInputForSource(source) {
  return {
    type: "image",
    url: source.dataUrl,
    detail: source.mimeType === "image/heic" || source.mimeType === "image/heif" ? "original" : "high",
  };
}

function initializeParams() {
  return {
    clientInfo: {
      name: "vchara-user-codex-worker",
      title: "vchara user Codex worker",
      version: "0.1.0",
    },
    capabilities: {
      experimentalApi: true,
      requestAttestation: false,
      optOutNotificationMethods: ["mcpServer/startupStatus/updated", "warning"],
    },
  };
}

class CodexAppServerClient {
  constructor() {
    this.pending = new Map();
    this.handlers = new Set();
    this.nextId = 1;
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    this.closed = false;
    this.child = spawn(codexCliPath, ["app-server", "--listen", "stdio://"], {
      cwd: process.cwd(),
      env: process.env,
    });
    this.child.stdout.on("data", (chunk) => {
      this.stdoutBuffer += chunk.toString("utf8");
      this.drainStdout();
    });
    this.child.stderr.on("data", (chunk) => {
      this.stderrBuffer = `${this.stderrBuffer}${chunk.toString("utf8")}`.slice(-4000);
    });
    this.child.on("error", (error) => this.rejectAll(error));
    this.child.on("close", () => {
      const wasClosed = this.closed;
      this.closed = true;
      if (!wasClosed) {
        this.rejectAll(new Error(`Codex app-server closed unexpectedly. ${this.stderrBuffer}`.trim()));
      }
    });
  }

  request(method, params) {
    if (this.closed) return Promise.reject(new Error("Codex app-server is already closed."));

    const id = this.nextId++;
    const payload = params === undefined ? { id, method } : { id, method, params };
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method, params) {
    if (this.closed) return;
    const payload = params === undefined ? { method } : { method, params };
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  addHandler(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.child.kill("SIGTERM");
  }

  drainStdout() {
    let newlineIndex = this.stdoutBuffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      newlineIndex = this.stdoutBuffer.indexOf("\n");

      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }

      if (isRecord(message)) this.handleMessage(message);
    }
  }

  handleMessage(message) {
    const id = message.id;

    if (typeof id === "number" && this.pending.has(id)) {
      const pending = this.pending.get(id);
      this.pending.delete(id);
      if (message.error !== undefined) {
        pending?.reject(new Error(toErrorMessage(message)));
      } else {
        pending?.resolve(message.result);
      }
      return;
    }

    for (const handler of this.handlers) {
      handler(message);
    }
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

async function waitForImageGeneration(client, turnId) {
  let imageResult;
  let savedPath;
  let turnError;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Codex app-server image generation timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    const cleanup = client.addHandler((message) => {
      const method = message.method;
      const params = message.params;
      if (!isRecord(params)) return;

      if (method === "error" && params.turnId === turnId) {
        turnError = getNestedString(params, ["error", "message"]) ?? "Codex app-server turn failed.";
      }

      if ((method === "item/completed" || method === "rawResponseItem/completed") && params.turnId === turnId) {
        const item = params.item;
        if (isRecord(item)) {
          const itemType = item.type;
          if ((itemType === "imageGeneration" || itemType === "image_generation_call") && typeof item.result === "string") {
            imageResult = item.result;
          }
          if (itemType === "imageGeneration" && typeof item.savedPath === "string") {
            savedPath = item.savedPath;
          }
        }
      }

      if (method !== "turn/completed") return;

      const completedTurnId = typeof params.turnId === "string" ? params.turnId : getNestedString(params, ["turn", "id"]);
      if (completedTurnId !== turnId) return;

      const status = getNestedString(params, ["turn", "status"]);
      clearTimeout(timeout);
      cleanup();

      if (status === "failed") {
        reject(new Error(turnError ?? getNestedString(params, ["turn", "error", "message"]) ?? "Codex app-server turn failed."));
        return;
      }

      if (imageResult) {
        resolve(imageResult);
        return;
      }

      if (savedPath) {
        readFile(savedPath)
          .then((file) => resolve(file.toString("base64")))
          .catch((error) => reject(error instanceof Error ? error : new Error(String(error))));
        return;
      }

      reject(new Error("Codex app-server completed without an image result."));
    });
  });
}

function normalizeImageResult(result) {
  const trimmed = String(result).trim();
  return trimmed.startsWith("data:image/") ? trimmed : `data:image/png;base64,${trimmed}`;
}

async function renderWithCodex(job) {
  const client = new CodexAppServerClient();

  try {
    await client.request("initialize", initializeParams());
    client.notify("initialized");

    const threadResult = await client.request("thread/start", {
      cwd: process.cwd(),
      approvalPolicy: "never",
      sandbox: "read-only",
      ephemeral: true,
      model,
      serviceTier: process.env.LOCAL_CODEX_SERVICE_TIER || undefined,
      baseInstructions:
        "You are a local image renderer for vchara. Use image generation when requested. Do not use shell commands, web search, file edits, or repository inspection.",
    });
    const threadId = getNestedString(threadResult, ["thread", "id"]);
    if (!threadId) throw new Error("Codex app-server did not return a thread id.");

    const turnResult = await client.request("turn/start", {
      threadId,
      cwd: process.cwd(),
      approvalPolicy: "never",
      effort,
      input: [
        {
          type: "text",
          text: buildPrompt(job),
          text_elements: [],
        },
        ...(job.sourceImages ?? []).map(imageInputForSource),
      ],
    });
    const turnId = getNestedString(turnResult, ["turn", "id"]);
    if (!turnId) throw new Error("Codex app-server did not return a turn id.");

    return normalizeImageResult(await waitForImageGeneration(client, turnId));
  } finally {
    client.close();
  }
}

async function processJob(job) {
  console.log(`[vchara-worker] rendering ${job.id}`);

  try {
    const imageUrl = await renderWithCodex(job);
    await api(`/api/codex-worker/jobs/${encodeURIComponent(job.id)}/complete`, {
      method: "POST",
      body: JSON.stringify({
        imageUrl,
        width: job.width,
        height: job.height,
        model,
      }),
    });
    console.log(`[vchara-worker] completed ${job.id}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await api(`/api/codex-worker/jobs/${encodeURIComponent(job.id)}/fail`, {
      method: "POST",
      body: JSON.stringify({
        reason,
        model,
      }),
    }).catch((failError) => {
      console.error(`[vchara-worker] failed to report job failure: ${failError.message}`);
    });
    console.error(`[vchara-worker] failed ${job.id}: ${reason}`);
  }
}

console.log(`[vchara-worker] connecting to ${siteUrl}`);

while (!shouldStop) {
  try {
    const payload = await api("/api/codex-worker/jobs/claim", { method: "POST" });
    if (payload.job) {
      await processJob(payload.job);
    } else {
      await sleep(pollMs);
    }
  } catch (error) {
    console.error(`[vchara-worker] ${error instanceof Error ? error.message : String(error)}`);
    await sleep(pollMs);
  }
}

console.log("[vchara-worker] stopped");
