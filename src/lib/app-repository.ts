import "server-only";

import { ValidationError } from "@/lib/api-errors";
import { recordApiUsageLog } from "@/lib/api-usage";
import { base64ByteLength, base64ToBytes, bytesToBase64, textToBase64 } from "@/lib/binary";
import { getVcharaAssets, getVcharaDb } from "@/lib/cloudflare-bindings";
import { createId } from "@/lib/crypto-web";
import {
  dbBoolean,
  dbDate,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowRequiredDateIso,
  rowString,
} from "@/lib/d1-utils";
import {
  catalog,
  defaultDraft,
  getOption,
  isCustomSceneTemplateId,
  isMeaningfulOptionLabel,
  normalizeCharacterDraft,
  resolveDraftAccessoryLabels,
  resolveDraftColorLabel,
  resolveDraftColorPalette,
  resolveDraftFieldOption,
  sceneTemplates,
} from "@/lib/catalog";
import { defaultCharacterTemplates } from "@/lib/default-character-templates";
import { getProviderInfo } from "@/lib/image-provider";
import { buildSceneAnalysis, orientationFromSize, parseImageMetadata } from "@/lib/image-metadata";
import {
  buildGenerationPrompt,
  buildNormalizedCharacterPrompt,
  buildReferencePrompt,
} from "@/lib/prompt-builder";
import { hasConnectedUserCodexWorker } from "@/lib/user-codex-worker";
import {
  validateCharacterDraftInput,
  validateExistingCharacterRegistrationInput,
  validateGenerationRequestInput,
  validateUploadInput,
} from "@/lib/validation";
import type {
  AlbumDeletionResult,
  AlbumItem,
  AlbumTrashResult,
  Asset,
  BackgroundCrop,
  CharacterDraftInput,
  CharacterParts,
  CharacterSource,
  CharacterSpec,
  CodexWorkerClaimedJob,
  ExistingCharacterRegistrationInput,
  GenerationJob,
  GenerationJobPayload,
  GenerationRequestInput,
  JobStatus,
  PromptBreakdown,
  ProviderInfo,
  ReferenceImage,
  ReferenceImageKind,
  ReferencePack,
  RenderProvider,
  SceneAnalysis,
  SceneTemplate,
  UploadAssetInput,
} from "@/lib/types";

interface StoreState {
  characters: CharacterSpec[];
  referencePacks: ReferencePack[];
  sceneTemplates: SceneTemplate[];
  assets: Asset[];
  generationJobs: GenerationJob[];
  albumItems: AlbumItem[];
}

interface SystemStatus {
  provider: ProviderInfo;
  persistence: string;
  initialized: boolean;
}

declare global {
  var __vcharastudioUserWriteQueue: Map<string, Promise<void>> | undefined;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return undefined;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function fileExtensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  if (mimeType === "image/gif") return "gif";
  return "bin";
}

function normalizeJobStatus(status: string | undefined): JobStatus {
  if (status === "queued") return "queued";
  if (status === "analyzing-background") return "analyzing-background";
  if (status === "preparing-references") return "preparing-references";
  if (status === "rendering" || status === "processing") return "rendering";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "queued";
}

function userWriteQueue() {
  if (!globalThis.__vcharastudioUserWriteQueue) {
    globalThis.__vcharastudioUserWriteQueue = new Map<string, Promise<void>>();
  }

  return globalThis.__vcharastudioUserWriteQueue;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function previewTemplateDataUrl(name: string) {
  const safeName = escapeSvgText(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1098" viewBox="0 0 960 1098"><rect width="960" height="1098" fill="#f6eee5"/><rect x="84" y="80" width="792" height="938" rx="28" fill="#ffffff"/><circle cx="480" cy="346" r="132" fill="#f08a70"/><path d="M286 812c26-185 135-290 194-290s168 105 194 290" fill="#7aa088"/><path d="M368 340c21-52 62-82 112-82s91 30 112 82v116c0 64-50 116-112 116s-112-52-112-116z" fill="#ffd2bb"/><path d="M354 332c38-104 219-110 253 7-60-24-122-29-253-7z" fill="#2f3f54"/><text x="480" y="920" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#2f3f54">${safeName}</text><text x="480" y="970" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#7a6a5d">Cloudflare Preview</text></svg>`;
  return `data:image/svg+xml;base64,${textToBase64(svg)}`;
}

function safeSvgColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function referencePlaceholderDataUrl(character: CharacterSpec) {
  const palette = character.parts.colorPalette;
  const primary = safeSvgColor(palette?.primary, "#ef7f69");
  const secondary = safeSvgColor(palette?.secondary, "#7aa088");
  const accent = safeSvgColor(palette?.accent, "#fff2e8");
  const detail = safeSvgColor(palette?.detail, "#2f3f54");
  const highlight = safeSvgColor(palette?.highlight, "#f6d66a");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1200" viewBox="0 0 960 1200"><rect width="960" height="1200" fill="${accent}"/><rect x="108" y="84" width="744" height="1032" rx="28" fill="#fffaf6"/><circle cx="480" cy="318" r="134" fill="${highlight}"/><path d="M314 998c20-244 130-382 166-382s146 138 166 382" fill="${secondary}"/><path d="M356 326c18-96 70-148 124-148s106 52 124 148v126c0 70-55 128-124 128s-124-58-124-128z" fill="${primary}"/><path d="M336 324c34-138 258-148 296 8-92-36-192-42-296-8z" fill="${detail}"/><path d="M400 456c32 34 128 34 160 0" fill="none" stroke="${detail}" stroke-width="18" stroke-linecap="round"/><circle cx="436" cy="386" r="13" fill="${detail}"/><circle cx="524" cy="386" r="13" fill="${detail}"/></svg>`;
  return `data:image/svg+xml;base64,${textToBase64(svg)}`;
}

function serializeJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function characterFromRow(row: Record<string, unknown>): CharacterSpec {
  return {
    id: rowString(row.id),
    name: rowString(row.name),
    tagline: rowString(row.tagline),
    story: rowString(row.story),
    negativePrompt: rowString(row.negativePrompt),
    style: row.style === "anime" ? "anime" : "anime",
    source: row.source === "existing-assets" ? "existing-assets" : "builder",
    parts: parseJson<CharacterParts>(rowString(row.parts), createCharacterParts(defaultDraft)),
    normalizedPrompt: rowString(row.normalizedPrompt),
    createdAt: rowRequiredDateIso(row.createdAt),
    referencePackId: rowNullableString(row.referencePackId),
    consistencyAssetIds: parseJson<string[]>(rowString(row.consistencyAssetIds), []),
    isDefaultTemplate: rowBoolean(row.isDefaultTemplate),
    templateKey: rowNullableString(row.templateKey),
  };
}

function renderProviderFromValue(): RenderProvider {
  return "user-codex";
}

function referencePackFromRow(row: Record<string, unknown>): ReferencePack {
  return {
    id: rowString(row.id),
    characterId: rowString(row.characterId),
    provider: renderProviderFromValue(),
    origin: row.origin === "uploaded" ? "uploaded" : "generated",
    version: rowNumber(row.version),
    prompt: rowString(row.prompt),
    fixedPrompt: rowString(row.fixedPrompt),
    variationPrompt: rowString(row.variationPrompt),
    negativePrompt: rowString(row.negativePrompt),
    seed: rowNumber(row.seed),
    createdAt: rowRequiredDateIso(row.createdAt),
    images: parseJson<ReferenceImage[]>(rowString(row.images), []),
  };
}

function assetFromRow(row: Record<string, unknown>): Asset {
  const width = rowNumber(row.width);
  const height = rowNumber(row.height);
  return {
    id: rowString(row.id),
    kind: row.kind === "reference" || row.kind === "generated" || row.kind === "upload" ? row.kind : "generated",
    name: rowString(row.name),
    imageUrl: rowString(row.imageUrl),
    mimeType: rowString(row.mimeType, "image/png"),
    width,
    height,
    orientation: row.orientation === "landscape" || row.orientation === "portrait" || row.orientation === "square"
      ? row.orientation
      : orientationFromSize(width, height),
    fileSize: rowNumber(row.fileSize),
    createdAt: rowRequiredDateIso(row.createdAt),
    sceneAnalysis: parseJson<SceneAnalysis | undefined>(rowNullableString(row.sceneAnalysis), undefined),
    storagePath: rowNullableString(row.storagePath),
    sourceJobId: rowNullableString(row.sourceJobId),
    sourceAssetId: rowNullableString(row.sourceAssetId),
    trashedAt: rowDateIso(row.trashedAt),
  };
}

function rowDateIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return new Date(value).toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return undefined;
}

function generationJobFromRow(row: Record<string, unknown>): GenerationJob {
  const backgroundCrop = parseJson<BackgroundCrop>(rowString(row.backgroundCrop), {
    zoom: 100,
    focusX: 0,
    focusY: 0,
  });
  const promptBreakdown = parseJson<PromptBreakdown>(rowString(row.promptBreakdown), {
    characterCore: "",
    characterFlex: "",
    scene: "",
    direction: "",
    qualityGuard: "",
    negative: "",
  });

  return {
    id: rowString(row.id),
    characterId: rowString(row.characterId),
    characterIds: parseJson<string[]>(rowString(row.characterIds), [rowString(row.characterId)]),
    referencePackId: rowString(row.referencePackId),
    referencePackIds: parseJson<string[]>(rowString(row.referencePackIds), [rowString(row.referencePackId)]),
    provider: renderProviderFromValue(),
    mode: row.mode === "photo-composite" ? "photo-composite" : "scene-template",
    sceneTemplateId: rowNullableString(row.sceneTemplateId),
    sceneTemplateCustomText: rowNullableString(row.sceneTemplateCustomText),
    assetId: rowNullableString(row.assetId),
    pose: rowString(row.pose),
    poseCustomText: rowNullableString(row.poseCustomText),
    bodyPosture: rowString(row.bodyPosture, "unspecified"),
    bodyPostureCustomText: rowNullableString(row.bodyPostureCustomText),
    expression: rowString(row.expression),
    expressionCustomText: rowNullableString(row.expressionCustomText),
    cameraDistance: rowString(row.cameraDistance),
    aspectRatio: rowString(row.aspectRatio),
    placement: rowString(row.placement),
    placementCustomText: rowNullableString(row.placementCustomText),
    outfitOverride: rowString(row.outfitOverride),
    outfitOverrideCustomText: rowNullableString(row.outfitOverrideCustomText),
    consistencyMode:
      row.consistencyMode === "strict" ||
      row.consistencyMode === "balanced" ||
      row.consistencyMode === "free" ||
      row.consistencyMode === "unspecified"
        ? row.consistencyMode
        : "unspecified",
    backgroundCrop,
    subjectAnchor:
      row.subjectAnchor === "left" ||
      row.subjectAnchor === "center" ||
      row.subjectAnchor === "right" ||
      row.subjectAnchor === "unspecified"
        ? row.subjectAnchor
        : "unspecified",
    subjectScale: rowNumber(row.subjectScale),
    depthLayer:
      row.depthLayer === "foreground" ||
      row.depthLayer === "midground" ||
      row.depthLayer === "background" ||
      row.depthLayer === "unspecified"
        ? row.depthLayer
        : "unspecified",
    lightingMode:
      row.lightingMode === "unspecified" ||
      row.lightingMode === "match-background" ||
      row.lightingMode === "soft-studio" ||
      row.lightingMode === "golden-hour" ||
      row.lightingMode === "neon-dramatic"
        ? row.lightingMode
        : "unspecified",
    occlusionMode:
      row.occlusionMode === "unspecified" ||
      row.occlusionMode === "none" ||
      row.occlusionMode === "soft-foreground" ||
      row.occlusionMode === "frame-with-props"
        ? row.occlusionMode
        : "unspecified",
    styleStrength: rowNumber(row.styleStrength),
    fitToPhotoContent: rowBoolean(row.fitToPhotoContent),
    preserveBackgroundPhoto: rowBoolean(row.preserveBackgroundPhoto),
    characterRenderStyle: rowString(row.characterRenderStyle),
    characterRenderStyleCustomText: rowNullableString(row.characterRenderStyleCustomText),
    backgroundRenderStyle: rowString(row.backgroundRenderStyle),
    backgroundRenderStyleCustomText: rowNullableString(row.backgroundRenderStyleCustomText),
    variationOfJobId: rowNullableString(row.variationOfJobId),
    batchGroupId: rowNullableString(row.batchGroupId),
    prompt: rowString(row.prompt),
    promptBreakdown,
    negativePrompt: rowString(row.negativePrompt),
    backgroundAnalysis: parseJson<SceneAnalysis | undefined>(rowNullableString(row.backgroundAnalysis), undefined),
    referenceAssetIds: parseJson<string[]>(rowString(row.referenceAssetIds), []),
    status: normalizeJobStatus(rowString(row.status)),
    createdAt: rowRequiredDateIso(row.createdAt),
    updatedAt: rowRequiredDateIso(row.updatedAt),
    resultAssetId: rowNullableString(row.resultAssetId),
    albumItemId: rowNullableString(row.albumItemId),
    failureReason: rowNullableString(row.failureReason),
    codexWorkerId: rowNullableString(row.codexWorkerId),
    codexWorkerClaimedAt: rowDateIso(row.codexWorkerClaimedAt),
    codexWorkerLeaseUntil: rowDateIso(row.codexWorkerLeaseUntil),
    trashedAt: rowDateIso(row.trashedAt),
  };
}

function albumItemFromRow(row: Record<string, unknown>): AlbumItem {
  return {
    id: rowString(row.id),
    characterId: rowString(row.characterId),
    generationJobId: rowString(row.generationJobId),
    assetId: rowString(row.assetId),
    title: rowString(row.title),
    promptExcerpt: rowString(row.promptExcerpt),
    sourceMode: row.sourceMode === "photo-composite" ? "photo-composite" : "scene-template",
    favorite: rowBoolean(row.favorite),
    createdAt: rowRequiredDateIso(row.createdAt),
    trashedAt: rowDateIso(row.trashedAt),
  };
}

async function loadUserState(userId: string): Promise<StoreState> {
  const db = await getVcharaDb();
  const [characters, referencePacks, assets, generationJobs, albumItems] = await Promise.all([
    db.prepare('SELECT * FROM "Character" WHERE "userId" = ? ORDER BY "createdAt" DESC')
      .bind(userId)
      .all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM "ReferencePack" WHERE "userId" = ? ORDER BY "createdAt" DESC')
      .bind(userId)
      .all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM "Asset" WHERE "userId" = ? ORDER BY "createdAt" DESC')
      .bind(userId)
      .all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM "GenerationJob" WHERE "userId" = ? ORDER BY "createdAt" DESC')
      .bind(userId)
      .all<Record<string, unknown>>(),
    db.prepare('SELECT * FROM "AlbumItem" WHERE "userId" = ? ORDER BY "createdAt" DESC')
      .bind(userId)
      .all<Record<string, unknown>>(),
  ]);

  const state = {
    characters: (characters.results ?? []).map(characterFromRow),
    referencePacks: (referencePacks.results ?? []).map(referencePackFromRow),
    sceneTemplates,
    assets: (assets.results ?? []).map(assetFromRow),
    generationJobs: (generationJobs.results ?? []).map(generationJobFromRow),
    albumItems: (albumItems.results ?? []).map(albumItemFromRow),
  };

  return state;
}

async function saveUserState(userId: string, state: StoreState) {
  const db = await getVcharaDb();
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM "AlbumItem" WHERE "userId" = ?').bind(userId),
    db.prepare('DELETE FROM "GenerationJob" WHERE "userId" = ?').bind(userId),
    db.prepare('DELETE FROM "ReferencePack" WHERE "userId" = ?').bind(userId),
    db.prepare('DELETE FROM "Character" WHERE "userId" = ?').bind(userId),
    db.prepare('DELETE FROM "Asset" WHERE "userId" = ?').bind(userId),
  ];

  for (const character of state.characters) {
    statements.push(db.prepare(`
      INSERT INTO "Character" (
        "id", "userId", "name", "tagline", "story", "negativePrompt", "style", "source",
        "parts", "normalizedPrompt", "createdAt", "referencePackId", "consistencyAssetIds",
        "isDefaultTemplate", "templateKey"
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      character.id,
      userId,
      character.name,
      character.tagline,
      character.story,
      character.negativePrompt,
      character.style,
      character.source,
      serializeJson(character.parts),
      character.normalizedPrompt,
      dbDate(character.createdAt),
      character.referencePackId ?? null,
      serializeJson(character.consistencyAssetIds),
      dbBoolean(character.isDefaultTemplate),
      character.templateKey ?? null,
    ));
  }

  for (const pack of state.referencePacks) {
    statements.push(db.prepare(`
      INSERT INTO "ReferencePack" (
        "id", "userId", "characterId", "provider", "origin", "version", "prompt",
        "fixedPrompt", "variationPrompt", "negativePrompt", "seed", "createdAt", "images"
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      pack.id,
      userId,
      pack.characterId,
      pack.provider,
      pack.origin,
      pack.version,
      pack.prompt,
      pack.fixedPrompt,
      pack.variationPrompt,
      pack.negativePrompt,
      pack.seed,
      dbDate(pack.createdAt),
      serializeJson(pack.images),
    ));
  }

  for (const asset of state.assets) {
    statements.push(db.prepare(`
      INSERT INTO "Asset" (
        "id", "userId", "kind", "name", "imageUrl", "mimeType", "width", "height",
        "orientation", "fileSize", "createdAt", "sceneAnalysis", "storagePath",
        "sourceJobId", "sourceAssetId", "trashedAt"
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      asset.id,
      userId,
      asset.kind,
      asset.name,
      asset.imageUrl,
      asset.mimeType,
      asset.width,
      asset.height,
      asset.orientation,
      asset.fileSize,
      dbDate(asset.createdAt),
      asset.sceneAnalysis ? serializeJson(asset.sceneAnalysis) : null,
      asset.storagePath ?? null,
      asset.sourceJobId ?? null,
      asset.sourceAssetId ?? null,
      dbDate(asset.trashedAt),
    ));
  }

  for (const job of state.generationJobs) {
    statements.push(db.prepare(`
      INSERT INTO "GenerationJob" (
        "id", "userId", "characterId", "characterIds", "referencePackId", "referencePackIds",
        "provider", "mode", "sceneTemplateId", "sceneTemplateCustomText", "assetId", "pose",
        "poseCustomText", "bodyPosture", "bodyPostureCustomText", "expression", "expressionCustomText",
        "cameraDistance", "aspectRatio", "placement", "placementCustomText", "outfitOverride",
        "outfitOverrideCustomText", "consistencyMode", "backgroundCrop", "subjectAnchor",
        "subjectScale", "depthLayer", "lightingMode", "occlusionMode", "styleStrength",
        "fitToPhotoContent", "preserveBackgroundPhoto", "characterRenderStyle",
        "characterRenderStyleCustomText", "backgroundRenderStyle", "backgroundRenderStyleCustomText",
        "variationOfJobId", "batchGroupId", "prompt", "promptBreakdown", "negativePrompt",
        "backgroundAnalysis", "referenceAssetIds", "status", "createdAt", "updatedAt",
        "resultAssetId", "albumItemId", "failureReason", "codexWorkerId", "codexWorkerClaimedAt",
        "codexWorkerLeaseUntil", "trashedAt"
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      job.id,
      userId,
      job.characterId,
      serializeJson(job.characterIds ?? [job.characterId]),
      job.referencePackId,
      serializeJson(job.referencePackIds ?? [job.referencePackId]),
      job.provider,
      job.mode,
      job.sceneTemplateId ?? null,
      job.sceneTemplateCustomText ?? null,
      job.assetId ?? null,
      job.pose,
      job.poseCustomText ?? null,
      job.bodyPosture,
      job.bodyPostureCustomText ?? null,
      job.expression,
      job.expressionCustomText ?? null,
      job.cameraDistance,
      job.aspectRatio,
      job.placement,
      job.placementCustomText ?? null,
      job.outfitOverride,
      job.outfitOverrideCustomText ?? null,
      job.consistencyMode,
      serializeJson(job.backgroundCrop),
      job.subjectAnchor,
      Math.round(job.subjectScale),
      job.depthLayer,
      job.lightingMode,
      job.occlusionMode,
      Math.round(job.styleStrength),
      dbBoolean(job.fitToPhotoContent),
      dbBoolean(job.preserveBackgroundPhoto),
      job.characterRenderStyle,
      job.characterRenderStyleCustomText ?? null,
      job.backgroundRenderStyle,
      job.backgroundRenderStyleCustomText ?? null,
      job.variationOfJobId ?? null,
      job.batchGroupId ?? null,
      job.prompt,
      serializeJson(job.promptBreakdown),
      job.negativePrompt,
      job.backgroundAnalysis ? serializeJson(job.backgroundAnalysis) : null,
      serializeJson(job.referenceAssetIds),
      job.status,
      dbDate(job.createdAt),
      dbDate(job.updatedAt),
      job.resultAssetId ?? null,
      job.albumItemId ?? null,
      job.failureReason ?? null,
      job.codexWorkerId ?? null,
      dbDate(job.codexWorkerClaimedAt),
      dbDate(job.codexWorkerLeaseUntil),
      dbDate(job.trashedAt),
    ));
  }

  for (const item of state.albumItems) {
    statements.push(db.prepare(`
      INSERT INTO "AlbumItem" (
        "id", "userId", "characterId", "generationJobId", "assetId", "title",
        "promptExcerpt", "sourceMode", "favorite", "createdAt", "trashedAt"
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.id,
      userId,
      item.characterId,
      item.generationJobId,
      item.assetId,
      item.title,
      item.promptExcerpt,
      item.sourceMode,
      dbBoolean(item.favorite),
      dbDate(item.createdAt),
      dbDate(item.trashedAt),
    ));
  }

  await db.batch(statements);
}

async function withLockedUserState<T>(
  userId: string,
  mutate: (state: StoreState, persist: () => Promise<void>) => Promise<T> | T,
) {
  const queue = userWriteQueue();
  const previous = queue.get(userId) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const marker = previous.catch(() => undefined).then(() => current);
  queue.set(userId, marker);

  await previous.catch(() => undefined);

  try {
    const state = await loadUserState(userId);
    const persist = () => saveUserState(userId, state);
    const result = await mutate(state, persist);
    return result;
  } finally {
    releaseCurrent();
    if (queue.get(userId) === marker) {
      queue.delete(userId);
    }
  }
}

async function withUserMutation<T>(
  userId: string,
  mutate: (state: StoreState) => Promise<T> | T,
) {
  return withLockedUserState(userId, async (state, persist) => {
    const result = await mutate(state);
    await persist();
    return result;
  });
}

function createCharacterParts(draft: CharacterDraftInput): CharacterParts {
  const outerwearLabel = resolveDraftFieldOption(draft, "outerwear").label;
  const innerwearLabel = resolveDraftFieldOption(draft, "innerwear").label;
  const bottomsLabel = resolveDraftFieldOption(draft, "bottoms").label;
  const shoesLabel = resolveDraftFieldOption(draft, "shoes").label;
  const socksLabel = resolveDraftFieldOption(draft, "socks").label;
  const glovesLabel = resolveDraftFieldOption(draft, "gloves").label;
  const hatLabel = resolveDraftFieldOption(draft, "hat").label;
  const outfitLabel =
    draft.outfitSelectionMode === "separate"
      ? [innerwearLabel, bottomsLabel, outerwearLabel]
          .filter(isMeaningfulOptionLabel)
          .join(" / ")
      : (() => {
          const label = resolveDraftFieldOption(draft, "outfit").label;
          return isMeaningfulOptionLabel(label) ? label : "";
        })();

  return {
    outfitSelectionMode: draft.outfitSelectionMode,
    outfitSelectionModeLabel: getOption(catalog.outfitSelectionModes, draft.outfitSelectionMode).label,
    sex: draft.sex,
    sexLabel: getOption(catalog.sexes, draft.sex).label,
    ageGroup: draft.ageGroup,
    ageGroupLabel: getOption(catalog.ageGroups, draft.ageGroup).label,
    genderPresentation: draft.genderPresentation,
    genderPresentationLabel: resolveDraftFieldOption(draft, "genderPresentation").label,
    facePreset: draft.facePreset,
    facePresetLabel: resolveDraftFieldOption(draft, "facePreset").label,
    bodyPreset: draft.bodyPreset,
    bodyPresetLabel: resolveDraftFieldOption(draft, "bodyPreset").label,
    hairStyle: draft.hairStyle,
    hairStyleLabel: resolveDraftFieldOption(draft, "hairStyle").label,
    hairColor: draft.hairColor,
    hairColorLabel: resolveDraftFieldOption(draft, "hairColor").label,
    bangs: draft.bangs,
    bangsLabel: resolveDraftFieldOption(draft, "bangs").label,
    eyes: draft.eyes,
    eyesLabel: resolveDraftFieldOption(draft, "eyes").label,
    eyebrows: draft.eyebrows,
    eyebrowsLabel: resolveDraftFieldOption(draft, "eyebrows").label,
    mouth: draft.mouth,
    mouthLabel: resolveDraftFieldOption(draft, "mouth").label,
    faceShape: draft.faceShape,
    faceShapeLabel: resolveDraftFieldOption(draft, "faceShape").label,
    skinTone: draft.skinTone,
    skinToneLabel: resolveDraftFieldOption(draft, "skinTone").label,
    heightProfile: draft.heightProfile,
    heightProfileLabel: resolveDraftFieldOption(draft, "heightProfile").label,
    bodyType: draft.bodyType,
    bodyTypeLabel: resolveDraftFieldOption(draft, "bodyType").label,
    outfit: draft.outfit,
    outfitLabel,
    outfitMaterial: draft.outfitMaterial,
    outfitMaterialLabel: resolveDraftFieldOption(draft, "outfitMaterial").label,
    outfitPattern: draft.outfitPattern,
    outfitPatternLabel: resolveDraftFieldOption(draft, "outfitPattern").label,
    colorway: draft.colorway,
    colorwayLabel: resolveDraftColorLabel(draft),
    colorMode: draft.colorMode,
    colorPalette: resolveDraftColorPalette(draft),
    outerwear: draft.outerwear,
    outerwearLabel,
    innerwear: draft.innerwear,
    innerwearLabel,
    bottoms: draft.bottoms,
    bottomsLabel,
    shoes: draft.shoes,
    shoesLabel,
    socks: draft.socks,
    socksLabel,
    gloves: draft.gloves,
    glovesLabel,
    hat: draft.hat,
    hatLabel,
    onePoint: draft.onePoint,
    onePointLabel: resolveDraftFieldOption(draft, "onePoint").label,
    customFields: draft.customFields,
    customMarkText: draft.customMarkText,
    outfitDetailNotes: draft.outfitDetailNotes,
    accessories: draft.accessories,
    accessoriesLabel: resolveDraftAccessoryLabels(draft),
    customAccessoryNotes: draft.customAccessoryNotes,
  };
}

function referenceLabelForKind(kind: ReferenceImageKind, index: number) {
  if (kind === "reference-sheet") return "Registered Reference";
  if (kind === "full-body") return "Full-body Reference";
  if (kind === "portrait") return "Portrait Reference";
  if (kind === "three-quarter") return "Three-quarter Reference";
  if (kind === "expression-sheet") return "Expression Reference";
  return `Reference Images ${index + 1}`;
}

function uploadedReferenceKind(index: number, total: number): ReferenceImageKind {
  if (total <= 1) return "reference-sheet";

  const kinds: ReferenceImageKind[] = [
    "reference-sheet",
    "full-body",
    "portrait",
    "three-quarter",
    "expression-sheet",
    "portrait",
  ];

  return kinds[index] ?? "portrait";
}

async function getAssetBinary(asset: Asset) {
  if (asset.storagePath) {
    const bucket = await getVcharaAssets();
    const object = await bucket.get(asset.storagePath);
    if (!object) {
      throw new Error("Asset content is not accessible.");
    }

    return {
      buffer: new Uint8Array(await object.arrayBuffer()),
      mimeType: asset.mimeType,
    };
  }

  const parsedDataUrl = parseDataUrl(asset.imageUrl);
  if (!parsedDataUrl) {
    throw new Error("Asset content is not accessible.");
  }

  return {
    buffer: base64ToBytes(parsedDataUrl.data),
    mimeType: parsedDataUrl.mimeType,
  };
}

async function createAsset(
  userId: string,
  {
    kind,
    name,
    imageUrl,
    sourceJobId,
    sourceAssetId,
    width,
    height,
    fileSize,
    sceneAnalysis,
  }: {
    kind: Asset["kind"];
    name: string;
    imageUrl: string;
    sourceJobId?: string;
    sourceAssetId?: string;
    width: number;
    height: number;
    fileSize?: number;
    sceneAnalysis?: SceneAnalysis;
  },
) {
  const parsedDataUrl = parseDataUrl(imageUrl);
  const asset: Asset = {
    id: createId("asset"),
    kind,
    name,
    imageUrl,
    mimeType: parsedDataUrl?.mimeType ?? "image/png",
    width,
    height,
    orientation: orientationFromSize(width, height),
    fileSize: fileSize ?? (parsedDataUrl ? base64ByteLength(parsedDataUrl.data) : 0),
    createdAt: now(),
    sceneAnalysis,
    sourceJobId,
    sourceAssetId,
  };

  if (!parsedDataUrl) {
    return asset;
  }

  const extension = fileExtensionForMimeType(parsedDataUrl.mimeType);
  const storagePath = `assets/${userId}/${asset.id}.${extension}`;
  const bytes = base64ToBytes(parsedDataUrl.data);
  const bucket = await getVcharaAssets();

  await bucket.put(storagePath, bytes, {
    httpMetadata: {
      contentType: parsedDataUrl.mimeType,
    },
  });

  return {
    ...asset,
    imageUrl: `/api/assets/${asset.id}/content`,
    storagePath,
  } satisfies Asset;
}

function createCharacterRecord(
  draft: CharacterDraftInput,
  options?: {
    source?: CharacterSource;
    referencePackId?: string;
    consistencyAssetIds?: string[];
    requireTagline?: boolean;
    isDefaultTemplate?: boolean;
    templateKey?: string;
  },
): CharacterSpec {
  const normalizedDraft = validateCharacterDraftInput(normalizeCharacterDraft(draft), {
    requireTagline: options?.requireTagline,
  });

  return {
    id: createId("char"),
    name: normalizedDraft.name,
    tagline: normalizedDraft.tagline,
    story: normalizedDraft.story,
    negativePrompt: normalizedDraft.negativePrompt,
    style: "anime",
    source: options?.source ?? "builder",
    parts: createCharacterParts(normalizedDraft),
    normalizedPrompt: buildNormalizedCharacterPrompt(normalizedDraft),
    createdAt: now(),
    referencePackId: options?.referencePackId,
    consistencyAssetIds: options?.consistencyAssetIds ?? [],
    isDefaultTemplate: options?.isDefaultTemplate ?? false,
    templateKey: options?.templateKey,
  } satisfies CharacterSpec;
}

function applyDraftToCharacter(character: CharacterSpec, draft: CharacterDraftInput) {
  const normalizedDraft = validateCharacterDraftInput(normalizeCharacterDraft(draft));

  character.name = normalizedDraft.name;
  character.tagline = normalizedDraft.tagline;
  character.story = normalizedDraft.story;
  character.negativePrompt = normalizedDraft.negativePrompt;
  character.parts = createCharacterParts(normalizedDraft);
  character.normalizedPrompt = buildNormalizedCharacterPrompt(normalizedDraft);
}

function defaultTemplateError() {
  return new ValidationError("Default template is read-only", [
    {
      field: "characterId",
      message: "Default characters cannot be edited or deleted directly. Duplicate them first.",
    },
  ], 403);
}

function assertCharacterMutable(character: CharacterSpec) {
  if (character.isDefaultTemplate) {
    throw defaultTemplateError();
  }
}

async function createBundledTemplateAsset(
  userId: string,
  template: (typeof defaultCharacterTemplates)[number],
) {
  const dataUrl = previewTemplateDataUrl(template.name);
  const parsed = parseDataUrl(dataUrl);

  return createAsset(userId, {
    kind: "upload",
    name: template.referencePack.image.assetName,
    imageUrl: dataUrl,
    width: template.referencePack.image.width,
    height: template.referencePack.image.height,
    fileSize: parsed ? base64ByteLength(parsed.data) : 0,
  });
}

function createBundledTemplateCharacter(
  template: (typeof defaultCharacterTemplates)[number],
  assetId: string,
  referencePackId: string,
  createdAt: string,
): CharacterSpec {
  return {
    id: createId("char"),
    name: template.name,
    tagline: template.tagline,
    story: template.story,
    negativePrompt: template.negativePrompt,
    style: "anime",
    source: template.source,
    parts: clone(template.parts),
    normalizedPrompt: template.normalizedPrompt,
    createdAt,
    referencePackId,
    consistencyAssetIds: [assetId],
    isDefaultTemplate: true,
    templateKey: template.key,
  } satisfies CharacterSpec;
}

function createBundledTemplateReferencePack(
  template: (typeof defaultCharacterTemplates)[number],
  characterId: string,
  asset: Asset,
  createdAt: string,
): ReferencePack {
  return {
    id: createId("pack"),
    characterId,
    provider: template.referencePack.provider,
    origin: template.referencePack.origin,
    version: template.referencePack.version,
    prompt: template.referencePack.prompt,
    fixedPrompt: template.referencePack.fixedPrompt,
    variationPrompt: template.referencePack.variationPrompt,
    negativePrompt: template.referencePack.negativePrompt,
    seed: template.referencePack.seed,
    createdAt,
    images: [
      {
        id: createId("ref"),
        kind: template.referencePack.image.kind,
        label: template.referencePack.image.label,
        prompt: template.referencePack.image.prompt,
        imageUrl: asset.imageUrl,
        assetId: asset.id,
      },
    ],
  } satisfies ReferencePack;
}

function renderSizeFromAspectRatio(aspectRatio: string, backgroundAsset?: Asset) {
  if (aspectRatio === "match-input" && backgroundAsset) {
    const sourceWidth = Math.max(1, backgroundAsset.width);
    const sourceHeight = Math.max(1, backgroundAsset.height);

    if (sourceWidth === sourceHeight) {
      return { width: 900, height: 900 };
    }

    if (sourceWidth > sourceHeight) {
      return {
        width: 1280,
        height: Math.max(1, Math.round((1280 * sourceHeight) / sourceWidth)),
      };
    }

    return {
      width: Math.max(1, Math.round((1200 * sourceWidth) / sourceHeight)),
      height: 1200,
    };
  }

  return undefined;
}

function renderRatioFromAspectRatio(aspectRatio: string) {
  return aspectRatio === "1:1" ? "1:1" : aspectRatio === "16:9" ? "16:9" : "4:5";
}

function referenceBlueprints(character: CharacterSpec) {
  return [
    {
      kind: "reference-sheet" as const,
      title: character.name,
      subtitle: "",
      accent: "#2e6f8f",
      textMode: "title-only" as const,
      ratio: "4:5" as const,
    },
  ];
}

async function createReferencePack(userId: string, character: CharacterSpec, version: number) {
  const provider = getProviderInfo().resolved;
  const seed = Math.floor(Math.random() * 900_000 + 100_000);
  const images: ReferenceImage[] = [];
  const assets: Asset[] = [];
  let prompt = "";
  let fixedPrompt = "";
  let variationPrompt = "";
  let negativePrompt = "";

  for (const blueprint of referenceBlueprints(character)) {
    const promptInfo = buildReferencePrompt(character, blueprint.kind);
    const imageUrl = referencePlaceholderDataUrl(character);

    const asset = await createAsset(userId, {
      kind: "reference",
      name: `${character.name}-${blueprint.kind}-v${version}`,
      imageUrl,
      width: 960,
      height: 1200,
    });

    assets.push(asset);
    images.push({
      id: createId("ref"),
      kind: blueprint.kind,
      label:
        blueprint.kind === "reference-sheet"
          ? "Three-view + Six-expression Sheet"
          : blueprint.kind === "full-body"
            ? "Front Full-body Reference"
            : blueprint.kind === "portrait"
              ? "Portrait Design Sheet"
              : blueprint.kind === "three-quarter"
                ? "Three-quarter Reference"
                : "Expression Variation Sheet",
      prompt: promptInfo.prompt,
      imageUrl: asset.imageUrl,
      assetId: asset.id,
    });

    prompt = promptInfo.prompt;
    fixedPrompt = promptInfo.fixedPrompt;
    variationPrompt = promptInfo.variationPrompt;
    negativePrompt = promptInfo.negativePrompt;
  }

  return {
    referencePack: {
      id: createId("pack"),
      characterId: character.id,
      provider,
      origin: "generated",
      version,
      prompt,
      fixedPrompt,
      variationPrompt,
      negativePrompt,
      seed,
      createdAt: now(),
      images,
    } satisfies ReferencePack,
    assets,
  };
}

function createUploadedReferencePack(character: CharacterSpec, assets: Asset[], version: number): ReferencePack {
  const promptInfo = buildReferencePrompt(character, "reference-sheet");
  const createdAt = now();

  return {
    id: createId("pack"),
    characterId: character.id,
    provider: "user-codex",
    origin: "uploaded",
    version,
    prompt: promptInfo.prompt,
    fixedPrompt: promptInfo.fixedPrompt,
    variationPrompt: promptInfo.variationPrompt,
    negativePrompt: promptInfo.negativePrompt,
    seed: 100000 + version,
    createdAt,
    images: assets.map((asset, index) => {
      const kind = uploadedReferenceKind(index, assets.length);

      return {
        id: createId("ref"),
        kind,
        label: referenceLabelForKind(kind, index),
        prompt: promptInfo.prompt,
        imageUrl: asset.imageUrl,
        assetId: asset.id,
      } satisfies ReferenceImage;
    }),
  } satisfies ReferencePack;
}

function latestReferencePackFromList(packs: ReferencePack[], characterId: string) {
  return packs
    .filter((item) => item.characterId === characterId)
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))[0];
}

function latestReferencePack(state: StoreState, characterId: string) {
  return latestReferencePackFromList(state.referencePacks, characterId);
}

function findCharacter(state: StoreState, characterId: string) {
  const character = state.characters.find((item) => item.id === characterId);
  if (!character) {
    throw new ValidationError("Character not found", [{ field: "characterId", message: "Character not found." }], 404);
  }
  return character;
}

function findAsset(state: StoreState, assetId: string) {
  const asset = state.assets.find((item) => item.id === assetId);
  if (!asset) {
    throw new ValidationError("Asset not found", [{ field: "assetId", message: "Background image not found." }], 404);
  }
  return asset;
}

function collectReferencedAssetIds(state: StoreState) {
  return new Set<string>([
    ...state.referencePacks.flatMap((pack) => pack.images.map((image) => image.assetId)),
    ...state.generationJobs.flatMap((job) =>
      [job.assetId, job.resultAssetId, ...job.referenceAssetIds].filter((item): item is string => Boolean(item)),
    ),
    ...state.albumItems.map((item) => item.assetId),
    ...state.characters.flatMap((item) => item.consistencyAssetIds),
  ]);
}

function detachConsistencyAssets(state: StoreState, assetIds: Set<string>) {
  for (const character of state.characters) {
    character.consistencyAssetIds = character.consistencyAssetIds.filter((assetId) => !assetIds.has(assetId));
  }
}

function reparentVariationChildren(state: StoreState, deletedJob: GenerationJob) {
  const directChildren = state.generationJobs
    .filter((job) => job.variationOfJobId === deletedJob.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (directChildren.length === 0) {
    return;
  }

  const [promotedRoot, ...siblings] = directChildren;
  promotedRoot.variationOfJobId = deletedJob.variationOfJobId;
  promotedRoot.updatedAt = now();

  for (const sibling of siblings) {
    sibling.variationOfJobId = promotedRoot.id;
    sibling.updatedAt = now();
  }
}

async function removeUnreferencedAssets(state: StoreState, candidateAssetIds: Set<string>) {
  const remainingReferencedAssetIds = collectReferencedAssetIds(state);
  const removableAssets = state.assets.filter(
    (asset) => candidateAssetIds.has(asset.id) && !remainingReferencedAssetIds.has(asset.id),
  );

  state.assets = state.assets.filter(
    (asset) => !(candidateAssetIds.has(asset.id) && !remainingReferencedAssetIds.has(asset.id)),
  );

  await Promise.all(
    removableAssets.map(async (asset) => {
      if (!asset.storagePath) return;
      const bucket = await getVcharaAssets();
      await bucket.delete(asset.storagePath).catch(() => undefined);
    }),
  );

  return removableAssets.map((asset) => asset.id);
}

function markAssetsTrashed(state: StoreState, assetIds: Set<string>, trashedAt: string) {
  const trashedAssetIds: string[] = [];

  for (const asset of state.assets) {
    if (!assetIds.has(asset.id)) {
      continue;
    }

    asset.trashedAt = trashedAt;
    trashedAssetIds.push(asset.id);
  }

  return trashedAssetIds;
}

function markJobsTrashed(state: StoreState, jobIds: Set<string>, trashedAt: string) {
  const trashedJobIds: string[] = [];

  for (const job of state.generationJobs) {
    if (!jobIds.has(job.id)) {
      continue;
    }

    job.trashedAt = trashedAt;
    job.updatedAt = trashedAt;
    trashedJobIds.push(job.id);
  }

  return trashedJobIds;
}

function markAlbumItemsTrashed(state: StoreState, albumItemIds: Set<string>, trashedAt: string) {
  const trashedAlbumItemIds: string[] = [];

  for (const item of state.albumItems) {
    if (!albumItemIds.has(item.id)) {
      continue;
    }

    item.trashedAt = trashedAt;
    trashedAlbumItemIds.push(item.id);
  }

  return trashedAlbumItemIds;
}

function resolveRecentSessionConsistencyAssetIds(
  state: StoreState,
  character: CharacterSpec,
  options?: { variationSource?: GenerationJob; limit?: number },
) {
  const collectedIds: string[] = [];

  const push = (assetId?: string) => {
    if (!assetId || collectedIds.includes(assetId)) return;
    collectedIds.push(assetId);
  };

  const variationSource = options?.variationSource;
  const variationSourceCharacterIds = variationSource
    ? [variationSource.characterId, ...(variationSource.characterIds ?? [])]
    : [];
  if (variationSource && variationSourceCharacterIds.includes(character.id)) {
    push(variationSource.resultAssetId);
  }

  return collectedIds.slice(0, options?.limit ?? collectedIds.length);
}

function resolveReferenceAssetIds(
  state: StoreState,
  character: CharacterSpec,
  referencePack: ReferencePack,
  consistencyMode: GenerationRequestInput["consistencyMode"],
  options?: { variationSource?: GenerationJob; posePriority?: boolean },
) {
  const packAssets = referencePack.images.map((image) => image.assetId);
  if (options?.posePriority || consistencyMode === "free" || consistencyMode === "unspecified") {
    return [...new Set(packAssets)];
  }

  const sessionConsistency =
    consistencyMode === "strict"
      ? resolveRecentSessionConsistencyAssetIds(state, character, {
          variationSource: options?.variationSource,
          limit: 2,
        })
      : resolveRecentSessionConsistencyAssetIds(state, character, {
          variationSource: options?.variationSource,
          limit: 1,
        });
  const adopted = (
    consistencyMode === "strict"
      ? character.consistencyAssetIds
      : character.consistencyAssetIds.slice(0, 2)
  ).filter((assetId) => !sessionConsistency.includes(assetId));

  return [...new Set([...packAssets, ...sessionConsistency, ...adopted])];
}

async function assetToRenderSource(asset: Asset, label: string) {
  const { buffer, mimeType } = await getAssetBinary(asset);
  return {
    label,
    mimeType,
    dataUrl: `data:${mimeType};base64,${bytesToBase64(buffer)}`,
  };
}

function buildJobTitle(job: GenerationJob, sceneTemplate?: SceneTemplate, backgroundAsset?: Asset) {
  const characterCount = job.characterIds?.length ?? 1;

  if (job.mode === "scene-template") {
    if (isCustomSceneTemplateId(job.sceneTemplateId)) {
      return characterCount > 1 ? "Custom Background Multi-character Composition" : "Custom Background Image";
    }

    return characterCount > 1
      ? `${sceneTemplate?.label ?? "Scene Template"} ${characterCount} characterscomposition`
      : `${sceneTemplate?.label ?? "Scene Template"} single image`;
  }

  return backgroundAsset
    ? `${backgroundAsset.name} ${characterCount > 1 ? `${characterCount} characters` : ""} composite variation`
    : "Uploaded Photo Composite";
}

function shouldPrioritizeCodexPose(
  job: Pick<GenerationJob | GenerationRequestInput, "pose" | "poseCustomText" | "bodyPosture" | "bodyPostureCustomText">,
) {
  return (
    job.pose !== "unspecified" ||
    Boolean(job.poseCustomText?.trim()) ||
    job.bodyPosture !== "unspecified" ||
    Boolean(job.bodyPostureCustomText?.trim())
  );
}

function jobCharactersInState(state: StoreState, job: GenerationJob) {
  return (job.characterIds?.length ? job.characterIds : [job.characterId]).map((characterId) =>
    findCharacter(state, characterId),
  );
}

function sourceAssetStatsForJob(state: StoreState, job: GenerationJob) {
  const sourceAssetIds = new Set([
    ...job.referenceAssetIds,
    ...[job.assetId].filter((assetId): assetId is string => Boolean(assetId)),
  ]);
  const sourceAssets = state.assets.filter((asset) => sourceAssetIds.has(asset.id));

  return {
    sourceImageCount: sourceAssets.length,
    sourceImageBytes: sourceAssets.reduce((total, asset) => total + asset.fileSize, 0),
  };
}

async function recordUserCodexJobUsage(
  state: StoreState,
  userId: string,
  job: GenerationJob,
  status: "success" | "error",
  options?: { model?: string; failureReason?: string },
) {
  const { sourceImageCount, sourceImageBytes } = sourceAssetStatsForJob(state, job);
  const startedAt = job.codexWorkerClaimedAt ?? job.createdAt;

  await recordApiUsageLog({
    userId,
    generationJobId: job.id,
    characterId: job.characterId,
    provider: "user-codex",
    model: options?.model,
    operationType: "generation",
    requestKind: job.mode,
    status,
    failureReason: options?.failureReason,
    promptChars: job.prompt.length,
    sourceImageCount,
    sourceImageBytes,
    responseImageCount: status === "success" ? 1 : 0,
    latencyMs: Math.max(0, Date.now() - new Date(startedAt).getTime()),
    estimatedCostMicros: 0,
  }).catch(() => undefined);
}

async function completeJobWithRenderedImage(
  state: StoreState,
  userId: string,
  job: GenerationJob,
  render: {
    imageUrl: string;
    width: number;
    height: number;
    provider: RenderProvider;
  },
) {
  const characters = jobCharactersInState(state, job);
  const character = characters[0];
  const sceneTemplate = state.sceneTemplates.find((item) => item.id === job.sceneTemplateId);
  const backgroundAsset = job.assetId ? findAsset(state, job.assetId) : undefined;
  const resultAsset = await createAsset(userId, {
    kind: "generated",
    name: `${characters.length > 1 ? `${character.name}-group-${characters.length}` : character.name}-${job.mode}-${job.id}`,
    imageUrl: render.imageUrl,
    width: render.width,
    height: render.height,
    sourceJobId: job.id,
    sourceAssetId: job.assetId,
  });
  const albumItem: AlbumItem = {
    id: createId("album"),
    characterId: character.id,
    generationJobId: job.id,
    assetId: resultAsset.id,
    title: buildJobTitle(job, sceneTemplate, backgroundAsset),
    promptExcerpt: job.prompt,
    sourceMode: job.mode,
    favorite: false,
    createdAt: now(),
  };

  state.assets.unshift(resultAsset);
  state.albumItems.unshift(albumItem);
  job.status = "completed";
  job.updatedAt = now();
  job.provider = render.provider;
  job.resultAssetId = resultAsset.id;
  job.albumItemId = albumItem.id;
  job.failureReason = undefined;
  job.codexWorkerLeaseUntil = undefined;

  return {
    resultAsset,
    albumItem,
  };
}

async function buildCodexWorkerClaimedJob(state: StoreState, job: GenerationJob): Promise<CodexWorkerClaimedJob> {
  const characters = jobCharactersInState(state, job);
  const character = characters[0];
  const sceneTemplate = state.sceneTemplates.find((item) => item.id === job.sceneTemplateId);
  const backgroundAsset = job.assetId ? findAsset(state, job.assetId) : undefined;
  const referenceAssets = job.referenceAssetIds
    .map((assetId) => state.assets.find((item) => item.id === assetId))
    .filter((item): item is Asset => Boolean(item));
  const referenceSourceImages = await Promise.all(
    referenceAssets.map((asset, index) =>
      assetToRenderSource(asset, index < 4 ? `Reference ${index + 1}` : `Consistency ${index - 3}`),
    ),
  );
  const sourceImages = backgroundAsset
    ? [
        ...referenceSourceImages,
        await assetToRenderSource(backgroundAsset, "Background photo"),
      ]
    : referenceSourceImages;
  const renderSize =
    renderSizeFromAspectRatio(job.aspectRatio, backgroundAsset) ??
    (renderRatioFromAspectRatio(job.aspectRatio) === "1:1"
      ? { width: 900, height: 900 }
      : renderRatioFromAspectRatio(job.aspectRatio) === "16:9"
        ? { width: 1280, height: 720 }
        : { width: 960, height: 1200 });

  return {
    id: job.id,
    title: characters.length > 1 ? `${character.name} +${characters.length - 1}` : character.name,
    subtitle:
      job.mode === "scene-template"
        ? isCustomSceneTemplateId(job.sceneTemplateId)
          ? "Custom Scene Template"
          : sceneTemplate?.label ?? "Scene Template"
        : "Composite into User Photo",
    prompt: job.prompt,
    width: renderSize.width,
    height: renderSize.height,
    posePriority: shouldPrioritizeCodexPose(job),
    sourceImages,
  };
}

async function generateReferencePackForCharacterInState(
  state: StoreState,
  userId: string,
  characterId: string,
  options?: { regenerate?: boolean; draft?: CharacterDraftInput },
) {
  const character = findCharacter(state, characterId);
  assertCharacterMutable(character);
  if (character.source !== "builder") {
    throw new ValidationError("Reference pack generation is only available for builder characters", [
      { field: "characterId", message: "Characters imported from existing images cannot regenerate AI references." },
    ], 400);
  }
  if (options?.draft) {
    applyDraftToCharacter(character, options.draft);
  }

  const existing = latestReferencePack(state, characterId);

  if (existing && !options?.regenerate) {
    character.referencePackId = existing.id;
    return existing;
  }

  const nextVersion = existing ? existing.version + 1 : 1;
  const { referencePack, assets } = await createReferencePack(userId, character, nextVersion);
  if (!existing || !options?.regenerate) {
    character.referencePackId = referencePack.id;
  }
  state.referencePacks.unshift(referencePack);
  state.assets.unshift(...assets);
  return referencePack;
}

export async function listCharacters(userId: string) {
  const state = await loadUserState(userId);
  return clone(state.characters);
}

export async function seedDefaultCharactersForUser(userId: string) {
  return withUserMutation(userId, async (state) => {
    const existingTemplateKeys = new Set(
      state.characters
        .map((character) => character.templateKey)
        .filter((templateKey): templateKey is string => Boolean(templateKey)),
    );
    const seededCharacters: CharacterSpec[] = [];

    for (const template of defaultCharacterTemplates) {
      if (existingTemplateKeys.has(template.key)) {
        continue;
      }

      const createdAt = now();
      const asset = await createBundledTemplateAsset(userId, template);
      const referencePackId = createId("pack");
      const character = createBundledTemplateCharacter(template, asset.id, referencePackId, createdAt);
      const referencePack = createBundledTemplateReferencePack(template, character.id, asset, createdAt);
      referencePack.id = referencePackId;

      state.assets.unshift(asset);
      state.characters.unshift(character);
      state.referencePacks.unshift(referencePack);
      existingTemplateKeys.add(template.key);
      seededCharacters.push(character);
    }

    return clone(seededCharacters);
  });
}

export async function listSceneTemplates() {
  return clone(sceneTemplates);
}

export async function listAlbumItems(userId: string, characterId?: string) {
  const state = await loadUserState(userId);
  const items = characterId
    ? state.albumItems.filter((item) => item.characterId === characterId)
    : state.albumItems;
  return clone(items);
}

export async function listGenerationJobs(userId: string) {
  const state = await loadUserState(userId);
  return clone(state.generationJobs);
}

export async function listReferencePacks(userId: string) {
  const state = await loadUserState(userId);
  return clone(state.referencePacks);
}

export async function listAssets(userId: string) {
  const state = await loadUserState(userId);
  return clone(state.assets);
}

export async function getGenerationJob(userId: string, jobId: string): Promise<GenerationJobPayload | undefined> {
  const state = await loadUserState(userId);
  const job = state.generationJobs.find((item) => item.id === jobId);
  if (!job) {
    return undefined;
  }

  const asset = job.resultAssetId ? state.assets.find((item) => item.id === job.resultAssetId) : undefined;
  const albumItem = job.albumItemId ? state.albumItems.find((item) => item.id === job.albumItemId) : undefined;
  const characters = (job.characterIds?.length ? job.characterIds : [job.characterId]).flatMap((characterId) => {
    const matchingCharacter = state.characters.find((item) => item.id === characterId);
    return matchingCharacter ? [matchingCharacter] : [];
  });
  const character = characters[0];
  const referencePack = state.referencePacks.find((item) => item.id === job.referencePackId);
  const backgroundAsset = job.assetId ? state.assets.find((item) => item.id === job.assetId) : undefined;
  const referenceAssets = job.referenceAssetIds
    .map((assetId) => state.assets.find((item) => item.id === assetId))
    .filter((item): item is Asset => Boolean(item));
  const variationChildren = state.generationJobs.filter((item) => item.variationOfJobId === job.id);
  const variationSource = job.variationOfJobId
    ? state.generationJobs.find((item) => item.id === job.variationOfJobId)
    : undefined;
  const usedSceneTemplate = state.sceneTemplates.find((item) => item.id === job.sceneTemplateId);

  return clone({
    job,
    asset,
    albumItem,
    character,
    characters,
    referencePack,
    backgroundAsset,
    referenceAssets,
    variationChildren,
    variationSource,
    usedSceneTemplate,
  });
}

export async function claimUserCodexWorkerJob(userId: string, workerId: string) {
  return withLockedUserState(userId, async (state, persist) => {
    const nowMs = Date.now();
    const claimableJob = [...state.generationJobs]
      .reverse()
      .find((job) => {
        if (job.provider !== "user-codex" || job.trashedAt || job.resultAssetId) return false;
        if (job.status === "queued") return true;
        if (job.status !== "rendering") return false;
        if (!job.codexWorkerLeaseUntil) return true;
        return new Date(job.codexWorkerLeaseUntil).getTime() < nowMs;
      });

    if (!claimableJob) {
      return undefined;
    }

    const claimedAt = now();
    claimableJob.status = "rendering";
    claimableJob.updatedAt = claimedAt;
    claimableJob.failureReason = undefined;
    claimableJob.codexWorkerId = workerId;
    claimableJob.codexWorkerClaimedAt = claimedAt;
    claimableJob.codexWorkerLeaseUntil = new Date(nowMs + 10 * 60 * 1000).toISOString();

    const payload = await buildCodexWorkerClaimedJob(state, claimableJob);
    await persist();

    return clone(payload);
  });
}

function positiveDimension(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 8192 ? Math.round(parsed) : fallback;
}

function stringField(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : undefined;
}

export async function completeUserCodexWorkerJob(
  userId: string,
  workerId: string,
  jobId: string,
  input: {
    imageUrl?: unknown;
    width?: unknown;
    height?: unknown;
    model?: unknown;
  },
) {
  return withLockedUserState(userId, async (state, persist) => {
    const job = state.generationJobs.find((item) => item.id === jobId);

    if (!job || job.provider !== "user-codex") {
      throw new ValidationError("Codex worker job not found", [], 404);
    }
    if (job.status === "completed") {
      return clone({ jobId: job.id, status: job.status });
    }
    if (job.codexWorkerId !== workerId) {
      throw new ValidationError("Codex worker job is claimed by another worker", [], 409);
    }

    const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
    if (!imageUrl.startsWith("data:image/") || !imageUrl.includes(";base64,")) {
      throw new ValidationError("Codex worker result image is required", [
        { field: "imageUrl", message: "A generated result data URL is required." },
      ]);
    }
    if (imageUrl.length > 30_000_000) {
      throw new ValidationError("Codex worker result image is too large", [
        { field: "imageUrl", message: "The generated result is too large." },
      ]);
    }

    const backgroundAsset = job.assetId ? state.assets.find((asset) => asset.id === job.assetId) : undefined;
    const fallbackSize =
      renderSizeFromAspectRatio(job.aspectRatio, backgroundAsset) ??
      (renderRatioFromAspectRatio(job.aspectRatio) === "1:1"
        ? { width: 900, height: 900 }
        : renderRatioFromAspectRatio(job.aspectRatio) === "16:9"
          ? { width: 1280, height: 720 }
          : { width: 960, height: 1200 });
    await completeJobWithRenderedImage(state, userId, job, {
      imageUrl,
      width: positiveDimension(input.width, fallbackSize.width),
      height: positiveDimension(input.height, fallbackSize.height),
      provider: "user-codex",
    });
    await recordUserCodexJobUsage(state, userId, job, "success", {
      model: stringField(input.model, 120),
    });
    await persist();

    return clone({ jobId: job.id, status: job.status });
  });
}

export async function failUserCodexWorkerJob(
  userId: string,
  workerId: string,
  jobId: string,
  input?: { reason?: unknown; model?: unknown },
) {
  return withLockedUserState(userId, async (state, persist) => {
    const job = state.generationJobs.find((item) => item.id === jobId);

    if (!job || job.provider !== "user-codex") {
      throw new ValidationError("Codex worker job not found", [], 404);
    }
    if (job.status === "completed") {
      return clone({ jobId: job.id, status: job.status });
    }
    if (job.codexWorkerId !== workerId) {
      throw new ValidationError("Codex worker job is claimed by another worker", [], 409);
    }

    const reason = stringField(input?.reason, 500) || "Codex worker failed.";
    job.status = "failed";
    job.updatedAt = now();
    job.failureReason = reason;
    job.codexWorkerLeaseUntil = undefined;

    await recordUserCodexJobUsage(state, userId, job, "error", {
      model: stringField(input?.model, 120),
      failureReason: reason,
    });
    await persist();

    return clone({ jobId: job.id, status: job.status });
  });
}

export async function createCharacter(userId: string, draft: CharacterDraftInput) {
  return withLockedUserState(userId, async (state, persist) => {
    const character = createCharacterRecord(draft);
    state.characters.unshift(character);
    await persist();
    return clone({ character });
  });
}

export async function createCharacterFromExistingAssets(userId: string, input: ExistingCharacterRegistrationInput) {
  return withLockedUserState(userId, async (state, persist) => {
    const normalizedInput = validateExistingCharacterRegistrationInput(input);
    const referenceAssetIds = [...new Set(normalizedInput.referenceAssetIds)];
    const referenceAssets = referenceAssetIds.map((assetId) => {
      const asset = state.assets.find((item) => item.id === assetId);
      if (!asset) {
        throw new ValidationError("Reference asset not found", [
          { field: "referenceAssetIds", message: "The selected reference image was not found." },
        ], 404);
      }
      return asset;
    });

    const character = createCharacterRecord(normalizedInput.draft, {
      source: "existing-assets",
      consistencyAssetIds: referenceAssetIds,
      requireTagline: false,
    });
    const referencePack = createUploadedReferencePack(character, referenceAssets, 1);
    character.referencePackId = referencePack.id;

    state.characters.unshift(character);
    state.referencePacks.unshift(referencePack);
    await persist();

    return clone({
      character,
      referencePack,
    });
  });
}

export async function updateCharacter(
  userId: string,
  characterId: string,
  input: { name?: string; tagline?: string },
) {
  return withUserMutation(userId, async (state) => {
    const character = findCharacter(state, characterId);
    assertCharacterMutable(character);
    const nextName = typeof input.name === "string" ? input.name.trim() : character.name;
    const nextTagline = typeof input.tagline === "string" ? input.tagline.trim() : character.tagline;

    if (!nextName) {
      throw new ValidationError("Character update failed", [
        { field: "name", message: "Character name is required." },
      ]);
    }

    character.name = nextName;
    character.tagline = nextTagline;

    return clone(character);
  });
}

export async function deleteCharacter(userId: string, characterId: string) {
  return withUserMutation(userId, async (state) => {
    const character = findCharacter(state, characterId);
    assertCharacterMutable(character);
    const deletedReferencePacks = state.referencePacks.filter((item) => item.characterId === characterId);
    const deletedJobs = state.generationJobs.filter((item) => item.characterId === characterId);
    const deletedAlbumItems = state.albumItems.filter((item) => item.characterId === characterId);
    const candidateAssetIds = new Set<string>([
      ...character.consistencyAssetIds,
      ...deletedReferencePacks.flatMap((pack) => pack.images.map((image) => image.assetId)),
      ...deletedJobs.flatMap((job) =>
        [job.assetId, job.resultAssetId, ...job.referenceAssetIds].filter((item): item is string => Boolean(item)),
      ),
      ...deletedAlbumItems.map((item) => item.assetId),
    ]);

    state.characters = state.characters.filter((item) => item.id !== characterId);
    state.referencePacks = state.referencePacks.filter((item) => item.characterId !== characterId);
    state.generationJobs = state.generationJobs.filter((item) => item.characterId !== characterId);
    state.albumItems = state.albumItems.filter((item) => item.characterId !== characterId);
    detachConsistencyAssets(state, candidateAssetIds);
    await removeUnreferencedAssets(state, candidateAssetIds);

    return clone({ deletedCharacterId: characterId });
  });
}

export async function duplicateDefaultTemplateCharacter(userId: string, characterId: string) {
  return withUserMutation(userId, async (state) => {
    const character = findCharacter(state, characterId);
    if (!character.isDefaultTemplate) {
      throw new ValidationError("Character is not a default template", [
        { field: "characterId", message: "Only default characters can be duplicated." },
      ], 400);
    }

    const referencePack = latestReferencePack(state, characterId);
    if (!referencePack) {
      throw new ValidationError("Reference pack not found", [
        { field: "characterId", message: "The template character reference image was not found." },
      ], 404);
    }

    const createdAt = now();
    const duplicatedCharacterId = createId("char");
    const duplicatedReferencePackId = createId("pack");
    const duplicatedCharacter: CharacterSpec = {
      ...clone(character),
      id: duplicatedCharacterId,
      name: `${character.name} Copy`,
      createdAt,
      referencePackId: duplicatedReferencePackId,
      consistencyAssetIds: [...character.consistencyAssetIds],
      isDefaultTemplate: false,
      templateKey: undefined,
    };
    const duplicatedReferencePack: ReferencePack = {
      ...clone(referencePack),
      id: duplicatedReferencePackId,
      characterId: duplicatedCharacterId,
      version: 1,
      createdAt,
      images: referencePack.images.map((image) => ({
        ...image,
        id: createId("ref"),
      })),
    };

    state.characters.unshift(duplicatedCharacter);
    state.referencePacks.unshift(duplicatedReferencePack);

    return clone({
      character: duplicatedCharacter,
      referencePack: duplicatedReferencePack,
    });
  });
}

export async function trashAlbumItem(userId: string, albumItemId: string): Promise<AlbumTrashResult> {
  return withUserMutation(userId, async (state) => {
    const albumItem = state.albumItems.find((item) => item.id === albumItemId);
    if (!albumItem) {
      throw new ValidationError("Album item not found", [{ field: "albumItemId", message: "Album item not found." }], 404);
    }

    const trashedAt = albumItem.trashedAt ?? now();
    const job = state.generationJobs.find((entry) => entry.id === albumItem.generationJobId);
    const assetIds = new Set<string>([
      albumItem.assetId,
      ...[job?.resultAssetId].filter((value): value is string => Boolean(value)),
    ]);

    if (job) {
      reparentVariationChildren(state, job);
    }

    const trashedAlbumItemIds = markAlbumItemsTrashed(state, new Set([albumItem.id]), trashedAt);
    const trashedJobIds = job ? markJobsTrashed(state, new Set([job.id]), trashedAt) : [];
    const trashedAssetIds = markAssetsTrashed(state, assetIds, trashedAt);

    return clone({
      trashedAt,
      trashedAlbumItemIds,
      trashedJobIds,
      trashedAssetIds,
    } satisfies AlbumTrashResult);
  });
}

export async function trashPhotoCompositeSourceByAlbumItem(userId: string, albumItemId: string): Promise<AlbumTrashResult> {
  return withUserMutation(userId, async (state) => {
    const albumItem = state.albumItems.find((item) => item.id === albumItemId);
    if (!albumItem) {
      throw new ValidationError("Album item not found", [{ field: "albumItemId", message: "Album item not found." }], 404);
    }

    const job = state.generationJobs.find((entry) => entry.id === albumItem.generationJobId);
    if (!job || job.mode !== "photo-composite" || !job.assetId) {
      throw new ValidationError("Photo source not found", [{ field: "albumItemId", message: "This item cannot move its photo composite source to trash." }], 400);
    }

    const trashedAt = albumItem.trashedAt ?? now();
    const backgroundAsset = findAsset(state, job.assetId);
    const targetJobs = state.generationJobs.filter((entry) => entry.mode === "photo-composite" && entry.assetId === backgroundAsset.id);
    const targetJobIds = new Set(targetJobs.map((entry) => entry.id));
    const targetAlbumItems = state.albumItems.filter((item) => targetJobIds.has(item.generationJobId));
    const targetAssetIds = new Set<string>([
      backgroundAsset.id,
      ...targetJobs.flatMap((entry) => [entry.resultAssetId].filter((value): value is string => Boolean(value))),
      ...targetAlbumItems.map((item) => item.assetId),
    ]);

    const trashedAlbumItemIds = markAlbumItemsTrashed(
      state,
      new Set(targetAlbumItems.map((item) => item.id)),
      trashedAt,
    );
    const trashedJobIds = markJobsTrashed(state, targetJobIds, trashedAt);
    const trashedAssetIds = markAssetsTrashed(state, targetAssetIds, trashedAt);

    return clone({
      trashedAt,
      trashedAlbumItemIds,
      trashedJobIds,
      trashedAssetIds,
    } satisfies AlbumTrashResult);
  });
}

export async function deleteAlbumItem(userId: string, albumItemId: string): Promise<AlbumDeletionResult> {
  return withUserMutation(userId, async (state) => {
    const albumItem = state.albumItems.find((item) => item.id === albumItemId);
    if (!albumItem) {
      throw new ValidationError("Album item not found", [{ field: "albumItemId", message: "Album item not found." }], 404);
    }
    if (!albumItem.trashedAt) {
      throw new ValidationError("Album item must be trashed first", [{ field: "albumItemId", message: "Permanent deletion must be performed from Trash." }], 400);
    }

    const job = state.generationJobs.find((entry) => entry.id === albumItem.generationJobId);
    const candidateAssetIds = new Set<string>([albumItem.assetId]);
    const deletedJobIds = job ? [job.id] : [];

    if (job?.resultAssetId) {
      candidateAssetIds.add(job.resultAssetId);
    }

    if (job) {
      reparentVariationChildren(state, job);
      state.generationJobs = state.generationJobs.filter((entry) => entry.id !== job.id);
    }

    state.albumItems = state.albumItems.filter((item) => item.id !== albumItem.id);
    detachConsistencyAssets(state, candidateAssetIds);
    const removedAssetIds = await removeUnreferencedAssets(state, candidateAssetIds);

    return clone({
      deletedAlbumItemIds: [albumItem.id],
      deletedJobIds,
      removedAssetIds,
    } satisfies AlbumDeletionResult);
  });
}

export async function deletePhotoCompositeSourceByAlbumItem(userId: string, albumItemId: string): Promise<AlbumDeletionResult> {
  return withUserMutation(userId, async (state) => {
    const albumItem = state.albumItems.find((item) => item.id === albumItemId);
    if (!albumItem) {
      throw new ValidationError("Album item not found", [{ field: "albumItemId", message: "Album item not found." }], 404);
    }
    if (!albumItem.trashedAt) {
      throw new ValidationError("Album item must be trashed first", [{ field: "albumItemId", message: "Permanent deletion must be performed from Trash." }], 400);
    }

    const job = state.generationJobs.find((entry) => entry.id === albumItem.generationJobId);
    if (!job || job.mode !== "photo-composite" || !job.assetId) {
      throw new ValidationError("Photo source not found", [{ field: "albumItemId", message: "This item cannot delete the photo composite source group." }], 400);
    }

    const backgroundAsset = findAsset(state, job.assetId);
    const deletedJobs = state.generationJobs.filter((entry) => entry.mode === "photo-composite" && entry.assetId === backgroundAsset.id);
    const deletedJobIds = deletedJobs.map((entry) => entry.id);
    const deletedAlbumItems = state.albumItems.filter((item) => deletedJobIds.includes(item.generationJobId));
    const candidateAssetIds = new Set<string>([
      backgroundAsset.id,
      ...deletedJobs.flatMap((entry) => [entry.resultAssetId].filter((value): value is string => Boolean(value))),
      ...deletedAlbumItems.map((item) => item.assetId),
    ]);

    state.generationJobs = state.generationJobs.filter((entry) => !deletedJobIds.includes(entry.id));
    state.albumItems = state.albumItems.filter((item) => !deletedJobIds.includes(item.generationJobId));
    detachConsistencyAssets(state, candidateAssetIds);
    const removedAssetIds = await removeUnreferencedAssets(state, candidateAssetIds);

    return clone({
      deletedAlbumItemIds: deletedAlbumItems.map((item) => item.id),
      deletedJobIds,
      removedAssetIds,
    } satisfies AlbumDeletionResult);
  });
}

export async function generateReferencePackForCharacter(
  userId: string,
  characterId: string,
  options?: { regenerate?: boolean; draft?: CharacterDraftInput },
) {
  return withUserMutation(userId, async (state) => {
    const referencePack = await generateReferencePackForCharacterInState(state, userId, characterId, options);
    return clone({
      character: findCharacter(state, characterId),
      referencePack,
    });
  });
}

export async function selectReferencePackForCharacter(userId: string, characterId: string, referencePackId: string) {
  return withUserMutation(userId, async (state) => {
    const character = findCharacter(state, characterId);
    const referencePack = state.referencePacks.find(
      (item) => item.id === referencePackId && item.characterId === characterId,
    );

    if (!referencePack) {
      throw new ValidationError("Reference pack not found", [
        { field: "referencePackId", message: "The selected reference sheet was not found." },
      ], 404);
    }

    character.referencePackId = referencePack.id;

    return clone({
      character,
      referencePack,
    });
  });
}

export async function clearConsistencyReferencesForCharacter(userId: string, characterId: string) {
  return withUserMutation(userId, async (state) => {
    const character = findCharacter(state, characterId);
    character.consistencyAssetIds = [];

    return clone(character);
  });
}

export async function uploadAsset(userId: string, file: File, input?: UploadAssetInput) {
  validateUploadInput(file, input);

  return withUserMutation(userId, async (state) => {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "image/png";
    const metadata = parseImageMetadata(buffer, mimeType);
    const dataUrl = `data:${mimeType};base64,${bytesToBase64(buffer)}`;

    const asset = await createAsset(userId, {
      kind: "upload",
      name: file.name || "uploaded-image",
      imageUrl: dataUrl,
      width: metadata.width,
      height: metadata.height,
      fileSize: file.size,
      sceneAnalysis: buildSceneAnalysis({
        fileName: file.name || "uploaded-image",
        orientation: metadata.orientation,
        input: input?.analysis,
      }),
    });

    state.assets.unshift(asset);
    return clone(asset);
  });
}

export async function createGenerationJob(userId: string, input: GenerationRequestInput) {
  return withLockedUserState(userId, async (state, persist) => {
    const normalizedInput = validateGenerationRequestInput(input);
    const providerInfo = getProviderInfo();
    const characters = normalizedInput.characterIds.map((characterId) => findCharacter(state, characterId));
    const sceneTemplate = state.sceneTemplates.find((item) => item.id === normalizedInput.sceneTemplateId);
    const backgroundAsset = normalizedInput.assetId ? findAsset(state, normalizedInput.assetId) : undefined;
    const variationSource = normalizedInput.variationOfJobId
      ? state.generationJobs.find((item) => item.id === normalizedInput.variationOfJobId)
      : undefined;
    const temporaryReferenceAssetIds = [...new Set(normalizedInput.temporaryReferenceAssetIds ?? [])];

    if (normalizedInput.variationOfJobId && !variationSource) {
      throw new ValidationError("Variation source not found", [
        { field: "variationOfJobId", message: "The source variation job was not found." },
      ]);
    }
    for (const assetId of temporaryReferenceAssetIds) {
      const asset = state.assets.find((item) => item.id === assetId);
      if (!asset || asset.trashedAt) {
        throw new ValidationError("Temporary reference asset not found", [
          { field: "temporaryReferenceAssetIds", message: "The temporary reference image was not found." },
        ], 404);
      }
    }
    if (!(await hasConnectedUserCodexWorker(userId))) {
      throw new ValidationError("Codex worker is not connected", [
        { field: "provider", message: "User Codex requires this account's Codex worker to be running." },
      ], 409);
    }

    const referencePacks: ReferencePack[] = [];

    for (const [index, selectedCharacter] of characters.entries()) {
      const requestedReferencePackId = normalizedInput.referencePackIds?.[index];
      const requestedReferencePack = requestedReferencePackId
        ? state.referencePacks.find(
            (item) => item.id === requestedReferencePackId && item.characterId === selectedCharacter.id,
          )
        : undefined;
      const selectedReferencePack = selectedCharacter.referencePackId
        ? state.referencePacks.find(
            (item) => item.id === selectedCharacter.referencePackId && item.characterId === selectedCharacter.id,
          )
        : undefined;
      const referencePack =
        requestedReferencePack ??
        selectedReferencePack ??
        latestReferencePack(state, selectedCharacter.id) ??
        (await generateReferencePackForCharacterInState(state, userId, selectedCharacter.id, { regenerate: true }));

      referencePacks.push(referencePack);
    }

    const codexPosePriority = shouldPrioritizeCodexPose(normalizedInput);
    const promptInfo = buildGenerationPrompt(characters, normalizedInput, {
      sceneTemplate,
      backgroundAnalysis: backgroundAsset?.sceneAnalysis,
      variationSource,
      codexPosePriority,
    });
    const referenceAssetIds = [...new Set(
      [
        ...characters.flatMap((selectedCharacter, index) =>
          resolveReferenceAssetIds(state, selectedCharacter, referencePacks[index], normalizedInput.consistencyMode, {
            variationSource,
            posePriority: codexPosePriority,
          }),
        ),
        ...temporaryReferenceAssetIds,
      ],
    )];

    const job: GenerationJob = {
      id: createId("job"),
      characterId: normalizedInput.characterId,
      characterIds: normalizedInput.characterIds,
      referencePackId: referencePacks[0].id,
      referencePackIds: referencePacks.map((item) => item.id),
      provider: providerInfo.resolved,
      mode: normalizedInput.mode,
      sceneTemplateId: normalizedInput.sceneTemplateId,
      sceneTemplateCustomText: normalizedInput.sceneTemplateCustomText,
      assetId: normalizedInput.assetId,
      pose: normalizedInput.pose,
      poseCustomText: normalizedInput.poseCustomText,
      bodyPosture: normalizedInput.bodyPosture,
      bodyPostureCustomText: normalizedInput.bodyPostureCustomText,
      expression: normalizedInput.expression,
      expressionCustomText: normalizedInput.expressionCustomText,
      cameraDistance: normalizedInput.cameraDistance,
      aspectRatio: normalizedInput.aspectRatio,
      placement: normalizedInput.placement,
      placementCustomText: normalizedInput.placementCustomText,
      outfitOverride: normalizedInput.outfitOverride,
      outfitOverrideCustomText: normalizedInput.outfitOverrideCustomText,
      consistencyMode: normalizedInput.consistencyMode,
      backgroundCrop: normalizedInput.backgroundCrop,
      subjectAnchor: normalizedInput.subjectAnchor,
      subjectScale: normalizedInput.subjectScale,
      depthLayer: normalizedInput.depthLayer,
      lightingMode: normalizedInput.lightingMode,
      occlusionMode: normalizedInput.occlusionMode,
      styleStrength: normalizedInput.styleStrength,
      fitToPhotoContent: normalizedInput.fitToPhotoContent,
      preserveBackgroundPhoto: normalizedInput.preserveBackgroundPhoto,
      characterRenderStyle: normalizedInput.characterRenderStyle,
      characterRenderStyleCustomText: normalizedInput.characterRenderStyleCustomText,
      backgroundRenderStyle: normalizedInput.backgroundRenderStyle,
      backgroundRenderStyleCustomText: normalizedInput.backgroundRenderStyleCustomText,
      variationOfJobId: normalizedInput.variationOfJobId,
      batchGroupId: normalizedInput.batchGroupId,
      prompt: promptInfo.prompt,
      promptBreakdown: promptInfo.breakdown,
      negativePrompt: promptInfo.negativePrompt,
      backgroundAnalysis: backgroundAsset?.sceneAnalysis,
      referenceAssetIds,
      status: "queued",
      createdAt: now(),
      updatedAt: now(),
    };

    state.generationJobs.unshift(job);
    await persist();

    return clone({ job });
  });
}

export async function toggleAlbumFavorite(userId: string, albumItemId: string) {
  return withUserMutation(userId, async (state) => {
    const item = state.albumItems.find((entry) => entry.id === albumItemId);
    if (!item) {
      throw new ValidationError("Album item not found", [{ field: "albumItemId", message: "Album item not found." }], 404);
    }

    item.favorite = !item.favorite;
    return clone(item);
  });
}

export async function adoptGenerationResultAsConsistencyReference(userId: string, jobId: string) {
  return withUserMutation(userId, async (state) => {
    const job = state.generationJobs.find((item) => item.id === jobId);
    if (!job?.resultAssetId) {
      throw new ValidationError("Generation result not found", [
        { field: "jobId", message: "No generated result is available to adopt." },
      ], 404);
    }

    const character = findCharacter(state, job.characterId);
    if (!character.consistencyAssetIds.includes(job.resultAssetId)) {
      character.consistencyAssetIds.unshift(job.resultAssetId);
      character.consistencyAssetIds = [...new Set(character.consistencyAssetIds)].slice(0, 6);
    }

    return clone({
      character,
      adoptedAssetId: job.resultAssetId,
    });
  });
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return {
    provider: getProviderInfo(),
    persistence: "cloudflare/d1+r2",
    initialized: true,
  };
}

export async function getAssetContent(userId: string, assetId: string) {
  const state = await loadUserState(userId);
  const asset = state.assets.find((item) => item.id === assetId);

  if (!asset) {
    return undefined;
  }

  return getAssetBinary(asset);
}

function safeDownloadFileName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "vchara-image";
}

export async function getAlbumItemDownloadEntries(userId: string, albumItemIds: string[]) {
  const state = await loadUserState(userId);
  const uniqueIds = [...new Set(albumItemIds.map((id) => id.trim()).filter(Boolean))];
  const entries: Array<{ fileName: string; buffer: Uint8Array; mimeType: string }> = [];

  for (const [index, albumItemId] of uniqueIds.entries()) {
    const albumItem = state.albumItems.find((item) => item.id === albumItemId && !item.trashedAt);
    if (!albumItem) continue;

    const asset = state.assets.find((item) => item.id === albumItem.assetId && !item.trashedAt);
    if (!asset) continue;

    const { buffer, mimeType } = await getAssetBinary(asset);
    const extension = fileExtensionForMimeType(mimeType);
    const baseName = safeDownloadFileName(albumItem.title || asset.name || `vchara-${index + 1}`);

    entries.push({
      fileName: `${String(index + 1).padStart(2, "0")}-${baseName}.${extension}`,
      buffer,
      mimeType,
    });
  }

  return entries;
}
