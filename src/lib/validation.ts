import {
  CUSTOM_SCENE_TEMPLATE_ID,
  catalog,
  hasOption,
  isCustomGenerationOption,
  normalizeCharacterDraft,
  normalizeGenerationCustomText,
  sceneTemplates,
} from "@/lib/catalog";
import { ValidationError } from "@/lib/api-errors";
import type {
  BackgroundCrop,
  CharacterDraftInput,
  ExistingCharacterRegistrationInput,
  GenerationRequestInput,
  UploadAnalysisInput,
  UploadAssetInput,
  ValidationProblem,
} from "@/lib/types";

export const SUPPORTED_UPLOAD_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCrop(input?: Partial<BackgroundCrop>): BackgroundCrop {
  return {
    zoom: clamp(Number(input?.zoom ?? 100), 80, 200),
    focusX: clamp(Number(input?.focusX ?? 0), -100, 100),
    focusY: clamp(Number(input?.focusY ?? 0), -100, 100),
  };
}

export function validateCharacterDraftInput(
  input: CharacterDraftInput,
  options?: { requireTagline?: boolean },
) {
  const draft = normalizeCharacterDraft(input);
  const fieldErrors: ValidationProblem[] = [];

  if (!draft.name.trim()) {
    fieldErrors.push({ field: "name", message: "Character name is required." });
  }

  if ((options?.requireTagline ?? true) && !draft.tagline.trim()) {
    fieldErrors.push({ field: "tagline", message: "Tagline is required." });
  }

  if (draft.accessories.length > 4) {
    fieldErrors.push({ field: "accessories", message: "Accessories are limited to four." });
  }

  if (fieldErrors.length) {
    throw new ValidationError("Character input is invalid.", fieldErrors);
  }

  return draft;
}

export function validateUploadInput(file: File, input?: UploadAssetInput) {
  const fieldErrors: ValidationProblem[] = [];

  if (!SUPPORTED_UPLOAD_TYPES.has(file.type)) {
    fieldErrors.push({
      field: "file",
      message: "Upload a PNG, JPEG, or WebP image.",
    });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    fieldErrors.push({
      field: "file",
      message: "Image size must be 10MB or less.",
    });
  }

  if (input?.analysis) {
    validateUploadAnalysis(input.analysis, fieldErrors);
  }

  if (fieldErrors.length) {
    throw new ValidationError("Uploaded image is invalid.", fieldErrors);
  }
}

export function validateExistingCharacterRegistrationInput(input: ExistingCharacterRegistrationInput) {
  const fieldErrors: ValidationProblem[] = [];

  if (!Array.isArray(input.referenceAssetIds) || input.referenceAssetIds.length === 0) {
    fieldErrors.push({
      field: "referenceAssetIds",
      message: "Upload at least one reference image.",
    });
  }

  if (Array.isArray(input.referenceAssetIds) && input.referenceAssetIds.length > 6) {
    fieldErrors.push({
      field: "referenceAssetIds",
      message: "You can register up to six reference images.",
    });
  }

  if (fieldErrors.length) {
    throw new ValidationError("Existing character registration is invalid.", fieldErrors);
  }

  return {
    draft: validateCharacterDraftInput(input.draft, { requireTagline: false }),
    referenceAssetIds: input.referenceAssetIds.map((assetId) => String(assetId).trim()).filter(Boolean),
  } satisfies ExistingCharacterRegistrationInput;
}

function validateUploadAnalysis(input: UploadAnalysisInput, fieldErrors: ValidationProblem[]) {
  if (
    input.environment &&
    input.environment !== "indoor" &&
    input.environment !== "outdoor" &&
    input.environment !== "mixed"
  ) {
    fieldErrors.push({ field: "analysis.environment", message: "Background environment value is invalid." });
  }

  if (
    input.brightness &&
    input.brightness !== "bright" &&
    input.brightness !== "balanced" &&
    input.brightness !== "moody"
  ) {
    fieldErrors.push({ field: "analysis.brightness", message: "Brightness analysis value is invalid." });
  }

  if (
    input.suggestedPlacement &&
    input.suggestedPlacement !== "left" &&
    input.suggestedPlacement !== "center" &&
    input.suggestedPlacement !== "right"
  ) {
    fieldErrors.push({ field: "analysis.suggestedPlacement", message: "Suggested placement value is invalid." });
  }
}

export function validateGenerationRequestInput(input: GenerationRequestInput) {
  const fieldErrors: ValidationProblem[] = [];
  const normalizedCharacterIds = [
    input.characterId,
    ...(Array.isArray(input.characterIds) ? input.characterIds : []),
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
  const normalizedReferencePackIds = (
    Array.isArray(input.referencePackIds) && input.referencePackIds.length
      ? input.referencePackIds
      : input.referencePackId
        ? [input.referencePackId]
        : []
  )
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
  const normalizedTemporaryReferenceAssetIds = (
    Array.isArray(input.temporaryReferenceAssetIds)
      ? input.temporaryReferenceAssetIds
      : []
  )
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
  const normalizedCustomTexts = {
    sceneTemplateCustomText: normalizeGenerationCustomText(input.sceneTemplateCustomText),
    poseCustomText: normalizeGenerationCustomText(input.poseCustomText),
    bodyPostureCustomText: normalizeGenerationCustomText(input.bodyPostureCustomText),
    expressionCustomText: normalizeGenerationCustomText(input.expressionCustomText),
    placementCustomText: normalizeGenerationCustomText(input.placementCustomText),
    outfitOverrideCustomText: normalizeGenerationCustomText(input.outfitOverrideCustomText),
    characterRenderStyleCustomText: normalizeGenerationCustomText(input.characterRenderStyleCustomText),
    backgroundRenderStyleCustomText: normalizeGenerationCustomText(input.backgroundRenderStyleCustomText),
  };
  const normalizedBatchGroupId = input.batchGroupId?.trim();

  if (!normalizedCharacterIds.length) {
    fieldErrors.push({ field: "characterId", message: "Select a character." });
  }

  if (input.referencePackId !== undefined && !input.referencePackId.trim()) {
    fieldErrors.push({ field: "referencePackId", message: "Reference sheet selection is invalid." });
  }
  if (normalizedTemporaryReferenceAssetIds.length > 3) {
    fieldErrors.push({ field: "temporaryReferenceAssetIds", message: "You can select up to three temporary references." });
  }

  if (input.mode !== "scene-template" && input.mode !== "photo-composite") {
    fieldErrors.push({ field: "mode", message: "Generation mode is invalid." });
  }

  if (input.mode === "scene-template") {
    if (input.sceneTemplateId === CUSTOM_SCENE_TEMPLATE_ID) {
      if (!normalizedCustomTexts.sceneTemplateCustomText) {
        fieldErrors.push({ field: "sceneTemplateCustomText", message: "Enter custom scene template text." });
      }
    } else if (!sceneTemplates.some((template) => template.id === input.sceneTemplateId)) {
      fieldErrors.push({ field: "sceneTemplateId", message: "Select a scene template." });
    }
  }

  if (input.mode === "photo-composite" && !input.assetId?.trim()) {
    fieldErrors.push({ field: "assetId", message: "Photo composite mode requires a background photo." });
  }

  if (!hasOption(catalog.poses, input.pose)) {
    fieldErrors.push({ field: "pose", message: "Pose selection is invalid." });
  }
  if (!hasOption(catalog.bodyPostures, input.bodyPosture)) {
    fieldErrors.push({ field: "bodyPosture", message: "Body posture selection is invalid." });
  }
  if (!hasOption(catalog.expressions, input.expression)) {
    fieldErrors.push({ field: "expression", message: "Expression selection is invalid." });
  }
  if (!hasOption(catalog.cameraDistances, input.cameraDistance)) {
    fieldErrors.push({ field: "cameraDistance", message: "Framing selection is invalid." });
  }
  if (!hasOption(catalog.aspectRatios, input.aspectRatio)) {
    fieldErrors.push({ field: "aspectRatio", message: "Aspect ratio selection is invalid." });
  }
  if (input.aspectRatio === "match-input" && input.mode !== "photo-composite") {
    fieldErrors.push({ field: "aspectRatio", message: "Matching the input aspect ratio is only available for photo composite mode." });
  } else if (input.aspectRatio === "match-input" && !input.assetId?.trim()) {
    fieldErrors.push({ field: "aspectRatio", message: "A background image is required to match the input aspect ratio." });
  }
  if (!hasOption(catalog.placements, input.placement)) {
    fieldErrors.push({ field: "placement", message: "Placement selection is invalid." });
  }
  if (!hasOption(catalog.outfits, input.outfitOverride)) {
    fieldErrors.push({ field: "outfitOverride", message: "Outfit selection is invalid." });
  }
  if (!hasOption(catalog.subjectAnchors, input.subjectAnchor)) {
    fieldErrors.push({ field: "subjectAnchor", message: "Subject anchor selection is invalid." });
  }
  if (!hasOption(catalog.depthLayers, input.depthLayer)) {
    fieldErrors.push({ field: "depthLayer", message: "Depth selection is invalid." });
  }
  if (!hasOption(catalog.lightingModes, input.lightingMode)) {
    fieldErrors.push({ field: "lightingMode", message: "Lighting mode is invalid." });
  }
  if (!hasOption(catalog.occlusionModes, input.occlusionMode)) {
    fieldErrors.push({ field: "occlusionMode", message: "Foreground selection is invalid." });
  }
  if (!hasOption(catalog.consistencyModes, input.consistencyMode)) {
    fieldErrors.push({ field: "consistencyMode", message: "Consistency mode is invalid." });
  }
  if (!hasOption(catalog.characterRenderStyles, input.characterRenderStyle)) {
    fieldErrors.push({ field: "characterRenderStyle", message: "Character rendering style is invalid." });
  }
  if (!hasOption(catalog.backgroundRenderStyles, input.backgroundRenderStyle)) {
    fieldErrors.push({ field: "backgroundRenderStyle", message: "Background rendering style is invalid." });
  }

  if (isCustomGenerationOption(input.pose) && !normalizedCustomTexts.poseCustomText) {
    fieldErrors.push({ field: "poseCustomText", message: "Enter custom pose text." });
  }
  if (isCustomGenerationOption(input.bodyPosture) && !normalizedCustomTexts.bodyPostureCustomText) {
    fieldErrors.push({ field: "bodyPostureCustomText", message: "Enter custom body posture text." });
  }
  if (isCustomGenerationOption(input.expression) && !normalizedCustomTexts.expressionCustomText) {
    fieldErrors.push({ field: "expressionCustomText", message: "Enter custom expression text." });
  }
  if (isCustomGenerationOption(input.placement) && !normalizedCustomTexts.placementCustomText) {
    fieldErrors.push({ field: "placementCustomText", message: "Enter custom placement text." });
  }
  if (isCustomGenerationOption(input.outfitOverride) && !normalizedCustomTexts.outfitOverrideCustomText) {
    fieldErrors.push({ field: "outfitOverrideCustomText", message: "Enter custom outfit text." });
  }
  if (isCustomGenerationOption(input.characterRenderStyle) && !normalizedCustomTexts.characterRenderStyleCustomText) {
    fieldErrors.push({ field: "characterRenderStyleCustomText", message: "Enter custom character rendering style text." });
  }
  if (isCustomGenerationOption(input.backgroundRenderStyle) && !normalizedCustomTexts.backgroundRenderStyleCustomText) {
    fieldErrors.push({ field: "backgroundRenderStyleCustomText", message: "Enter custom background rendering style text." });
  }

  if (input.variationOfJobId && !input.variationOfJobId.trim()) {
    fieldErrors.push({ field: "variationOfJobId", message: "Source variation job ID is invalid." });
  }
  if (input.batchGroupId !== undefined && !normalizedBatchGroupId) {
    fieldErrors.push({ field: "batchGroupId", message: "Batch generation ID is invalid." });
  }

  const normalized = {
    ...input,
    ...normalizedCustomTexts,
    characterId: normalizedCharacterIds[0] ?? "",
    characterIds: normalizedCharacterIds,
    referencePackId: normalizedReferencePackIds[0],
    referencePackIds: normalizedReferencePackIds,
    temporaryReferenceAssetIds: normalizedTemporaryReferenceAssetIds,
    fitToPhotoContent: Boolean(input.fitToPhotoContent),
    preserveBackgroundPhoto: input.preserveBackgroundPhoto ?? true,
    backgroundCrop: normalizeCrop(input.backgroundCrop),
    subjectScale: clamp(Number(input.subjectScale ?? 100), 60, 150),
    styleStrength: clamp(Number(input.styleStrength ?? 70), 0, 100),
    batchGroupId: normalizedBatchGroupId || undefined,
  } satisfies GenerationRequestInput;

  if (fieldErrors.length) {
    throw new ValidationError("Generation settings are invalid.", fieldErrors);
  }

  return normalized;
}
