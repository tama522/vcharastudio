"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatFileSize, prepareImageForUpload, type PreparedUploadImage } from "@/lib/client-upload-image";
import {
  CUSTOM_GENERATION_OPTION_ID,
  CUSTOM_SCENE_TEMPLATE_ID,
  catalog,
  getOption,
  isCustomGenerationOption,
  resolveGenerationFieldOption,
} from "@/lib/catalog";
import type {
  Asset,
  CharacterCatalogOption,
  CharacterSpec,
  GenerationJob,
  GenerationJobPayload,
  GenerationMode,
  GenerationRequestInput,
  ReferencePack,
  SceneTemplate,
} from "@/lib/types";

interface GenerationStudioProps {
  characters: CharacterSpec[];
  isAnonymous?: boolean;
  isSignedIn?: boolean;
  referencePacks: ReferencePack[];
  sceneTemplates: SceneTemplate[];
  initialCharacterId?: string;
  initialJobPayload?: GenerationJobPayload;
  initialJobMode?: "variation" | "edit";
  initialTemporaryReferenceAssetId?: string;
  initialTemporaryReferenceAsset?: Asset;
  initialTemporaryReferenceCharacterId?: string;
}

interface TemporaryReferenceState {
  assetId: string;
  asset?: Asset;
  characterId: string;
}

type BatchPhotoStatus = "ready" | "uploading" | "queued" | "rendering" | "completed" | "failed";

interface BatchPhotoItem {
  id: string;
  file: File;
  preparedImage: PreparedUploadImage;
  previewUrl: string;
  status: BatchPhotoStatus;
  assetId?: string;
  jobId?: string;
  provider?: GenerationJob["provider"];
  error?: string;
}

type PreflightIssueSeverity = "error" | "warning";

interface PreflightIssue {
  severity: PreflightIssueSeverity;
  message: string;
}

interface PreflightSummaryItem {
  label: string;
  value: string;
}

type GenerationPreflightState =
  | {
      kind: "single";
      request: GenerationRequestInput;
      title: string;
      confirmLabel: string;
      summary: PreflightSummaryItem[];
      issues: PreflightIssue[];
    }
  | {
      kind: "batch";
      title: string;
      confirmLabel: string;
      summary: PreflightSummaryItem[];
      issues: PreflightIssue[];
    };

interface FieldHelpLabelProps {
  htmlFor: string;
  label: string;
  description: string;
}

function FieldHelpLabel({ htmlFor, label, description }: FieldHelpLabelProps) {
  const tooltipId = `${htmlFor}-help`;

  return (
    <div className="field-label-row">
      <label className="field-label" htmlFor={htmlFor}>{label}</label>
      <div className="info-tooltip">
        <button
          aria-describedby={tooltipId}
          aria-label={`${label} help`}
          className="info-tooltip-trigger"
          type="button"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="10" cy="10" r="7.25" />
            <path d="M10 8.1a1.8 1.8 0 1 1 1.4 2.9c-.78.19-1.4.7-1.4 1.55v.35" strokeLinecap="round" />
            <circle cx="10" cy="15.1" r="0.9" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <div className="info-tooltip-popup" id={tooltipId} role="tooltip">
          {description}
        </div>
      </div>
    </div>
  );
}

interface SelectWithCustomInputProps {
  id: string;
  label: string;
  description?: string;
  options: CharacterCatalogOption[];
  value: string;
  customValue?: string;
  customPlaceholder: string;
  customHint?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  onCustomValueChange: (value: string) => void;
}

function SelectWithCustomInput({
  id,
  label,
  description,
  options,
  value,
  customValue,
  customPlaceholder,
  customHint,
  disabled,
  onValueChange,
  onCustomValueChange,
}: SelectWithCustomInputProps) {
  const customInputId = `${id}CustomText`;

  return (
    <div className="field">
      {description ? (
        <FieldHelpLabel description={description} htmlFor={id} label={label} />
      ) : (
        <label className="field-label" htmlFor={id}>{label}</label>
      )}
      <select
        className="select"
        disabled={disabled}
        id={id}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} disabled={option.disabled} value={option.id}>{option.label}</option>
        ))}
      </select>
      {isCustomGenerationOption(value) ? (
        <div className="stack-sm">
          <input
            aria-label={`${label} custom text`}
            className="input"
            disabled={disabled}
            id={customInputId}
            placeholder={customPlaceholder}
            type="text"
            value={customValue ?? ""}
            onChange={(event) => onCustomValueChange(event.target.value)}
          />
          {customHint ? <p className="field-hint">{customHint}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

const MAX_COMPOSITE_CHARACTERS = 4;
const MAX_BATCH_PHOTOS = 12;
const DEFAULT_SUBJECT_SCALE = 112;
const LANDSCAPE_SUBJECT_SCALE_FLOOR = 128;
const WIDE_LANDSCAPE_SUBJECT_SCALE_FLOOR = 142;

const batchCompositionPresets = [
  {
    label: "Close Left Foreground",
    cameraDistance: "waist-up",
    placement: "left-lower-foreground",
    subjectScaleOffset: 6,
    bodyPostureDirection: "Use a posture that makes the upper body readable and places the character naturally in the foreground.",
    poseDirection: "Close lower-left composition with readable face and expression. Do not overemphasize empty background space.",
  },
  {
    label: "Knee-up Right Foreground",
    cameraDistance: "medium",
    placement: "right-lower-foreground",
    subjectScaleOffset: 0,
    bodyPostureDirection: "Use a knee-up posture with believable grounding against the floor or furniture.",
    poseDirection: "Right foreground knee-up composition. Avoid matching the previous position, face size, or direction.",
  },
  {
    label: "Centered Chest-up",
    cameraDistance: "chest-up",
    placement: "center",
    subjectScaleOffset: 10,
    bodyPostureDirection: "Frame the chest-up area so the face and upper outfit become the focus.",
    poseDirection: "Centered chest-up composition. Prioritize expression over background and make it closer than the other batch outputs.",
  },
  {
    label: "Wider Full-body",
    cameraDistance: "full",
    placement: "photo-auto",
    subjectScaleOffset: -6,
    bodyPostureDirection: "Use a full-body posture when the floor and depth support it; otherwise crop naturally around the knees.",
    poseDirection: "Wider composition that shows the environment. Add more space and body coverage than the close compositions.",
  },
] as const;

function uniqueIds(values: string[]) {
  return values.filter((value, index, list) => Boolean(value) && list.indexOf(value) === index);
}

function resolveCompositeCharacterIds(input: Pick<GenerationRequestInput, "characterId" | "characterIds">) {
  return uniqueIds([
    input.characterId,
    ...(Array.isArray(input.characterIds) ? input.characterIds : []),
  ]);
}

function shortList(values: string[], limit = 3) {
  const visibleValues = values.filter(Boolean);
  if (!visibleValues.length) return "Not selected";
  if (visibleValues.length <= limit) return visibleValues.join(", ");
  return `${visibleValues.slice(0, limit).join(", ")} +${visibleValues.length - limit} more`;
}

function clampSubjectScale(value: number) {
  return Math.max(60, Math.min(150, Math.round(value)));
}

function recommendedSubjectScaleForImage(width: number, height: number) {
  if (!width || !height || width <= height) return null;
  const ratio = width / height;
  if (ratio >= 1.65) return WIDE_LANDSCAPE_SUBJECT_SCALE_FLOOR;
  if (ratio >= 1.2) return LANDSCAPE_SUBJECT_SCALE_FLOOR;
  return null;
}

function pushCustomTextIssue(
  issues: PreflightIssue[],
  label: string,
  value: string,
  customText?: string,
) {
  if (!isCustomGenerationOption(value) || customText?.trim()) {
    return;
  }

  issues.push({
    severity: "error",
    message: `${label} is set to custom text, but the text is empty.`,
  });
}

function buildReferencePackSelectionMap(
  characterIds: string[],
  characters: CharacterSpec[],
  referencePacks: ReferencePack[],
  job?: GenerationJob,
) {
  return characterIds.reduce<Record<string, string>>((accumulator, characterId, index) => {
    const character = characters.find((item) => item.id === characterId);
    const requestedPackId = job?.referencePackIds?.[index] ?? (index === 0 ? job?.referencePackId : undefined);
    const fallbackPackId =
      requestedPackId ??
      character?.referencePackId ??
      latestReferencePack(referencePacks, characterId)?.id ??
      "";
    if (fallbackPackId) {
      accumulator[characterId] = fallbackPackId;
    }
    return accumulator;
  }, {});
}

function sceneTemplateLabel(
  sceneTemplates: SceneTemplate[],
  request: Pick<GenerationRequestInput, "sceneTemplateId" | "sceneTemplateCustomText">,
) {
  if (request.sceneTemplateId === CUSTOM_SCENE_TEMPLATE_ID) {
    return request.sceneTemplateCustomText?.trim() || "Custom Text";
  }

  return sceneTemplates.find((template) => template.id === request.sceneTemplateId)?.label ?? "Scene Template";
}

function characterOptionsForRow(
  characters: CharacterSpec[],
  selectedCharacterIds: string[],
  rowIndex: number,
) {
  const currentCharacterId = selectedCharacterIds[rowIndex];
  return characters.filter((character) =>
    character.id === currentCharacterId || !selectedCharacterIds.includes(character.id),
  );
}

function defaultRequest(characterId: string): GenerationRequestInput {
  return {
    characterId,
    characterIds: characterId ? [characterId] : [],
    referencePackIds: [],
    mode: "photo-composite",
    sceneTemplateId: "travel-harbor",
    sceneTemplateCustomText: "",
    pose: "unspecified",
    poseCustomText: "",
    bodyPosture: "unspecified",
    bodyPostureCustomText: "",
    expression: "unspecified",
    expressionCustomText: "",
    cameraDistance: "auto-photo",
    aspectRatio: "match-input",
    placement: "photo-auto",
    placementCustomText: "",
    outfitOverride: "unspecified",
    outfitOverrideCustomText: "",
    consistencyMode: "strict",
    backgroundCrop: { zoom: 100, focusX: 0, focusY: 0 },
    subjectAnchor: "unspecified",
    subjectScale: DEFAULT_SUBJECT_SCALE,
    depthLayer: "unspecified",
    lightingMode: "match-background",
    occlusionMode: "unspecified",
    styleStrength: 70,
    fitToPhotoContent: true,
    preserveBackgroundPhoto: true,
    characterRenderStyle: "unspecified",
    characterRenderStyleCustomText: "",
    backgroundRenderStyle: "unspecified",
    backgroundRenderStyleCustomText: "",
  };
}

function requestFromJob(
  job: GenerationJob,
  options?: { inheritAsVariation?: boolean },
): GenerationRequestInput {
  return {
    characterId: job.characterId,
    characterIds: job.characterIds ?? [job.characterId],
    referencePackId: job.referencePackId,
    referencePackIds: job.referencePackIds ?? [job.referencePackId],
    mode: job.mode,
    sceneTemplateId: job.sceneTemplateId,
    sceneTemplateCustomText: job.sceneTemplateCustomText ?? "",
    assetId: job.assetId,
    pose: job.pose,
    poseCustomText: job.poseCustomText ?? "",
    bodyPosture: job.bodyPosture,
    bodyPostureCustomText: job.bodyPostureCustomText ?? "",
    expression: job.expression,
    expressionCustomText: job.expressionCustomText ?? "",
    cameraDistance: job.cameraDistance,
    aspectRatio: job.aspectRatio,
    placement: job.placement,
    placementCustomText: job.placementCustomText ?? "",
    outfitOverride: job.outfitOverride,
    outfitOverrideCustomText: job.outfitOverrideCustomText ?? "",
    consistencyMode: "strict",
    backgroundCrop: job.backgroundCrop,
    subjectAnchor: "unspecified",
    subjectScale: job.subjectScale,
    depthLayer: job.depthLayer,
    lightingMode: job.lightingMode,
    occlusionMode: job.occlusionMode,
    styleStrength: job.styleStrength,
    fitToPhotoContent: job.fitToPhotoContent,
    preserveBackgroundPhoto: job.preserveBackgroundPhoto,
    characterRenderStyle: job.characterRenderStyle,
    characterRenderStyleCustomText: job.characterRenderStyleCustomText ?? "",
    backgroundRenderStyle: job.backgroundRenderStyle,
    backgroundRenderStyleCustomText: job.backgroundRenderStyleCustomText ?? "",
    variationOfJobId: options?.inheritAsVariation ? job.id : undefined,
  };
}

function formatStatus(status: GenerationJob["status"]) {
  if (status === "queued") return "Preparing...";
  if (status === "analyzing-background") return "Analyzing background...";
  if (status === "preparing-references") return "Preparing references...";
  if (status === "rendering") return "Generating...";
  if (status === "failed") return "Failure";
  return "Complete";
}

function progressDescription(status?: GenerationJob["status"]) {
  if (status === "queued") return "Creating the job.";
  if (status === "analyzing-background") return "Analyzing background brightness and placement.";
  if (status === "preparing-references") return "Preparing references and consistency assets.";
  if (status === "rendering") return "Generating the image with the selected composition and lighting.";
  if (status === "completed") return "Complete. Opening the result page.";
  if (status === "failed") return "Generation failed. Review the settings and try again.";
  return "Submitting generation settings.";
}

function batchPhotoStatusLabel(status: BatchPhotoStatus) {
  if (status === "uploading") return "Uploading";
  if (status === "queued") return "Queued";
  if (status === "rendering") return "Generating";
  if (status === "completed") return "Complete";
  if (status === "failed") return "Failure";
  return "Ready";
}

function renderProviderLabel(provider?: GenerationJob["provider"]) {
  return provider === "user-codex" ? "User Codex" : null;
}

function isInProgress(status?: GenerationJob["status"]) {
  return (
    status === "queued" ||
    status === "analyzing-background" ||
    status === "preparing-references" ||
    status === "rendering"
  );
}

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    fieldErrors?: Array<{ message?: string }>;
  };

  return payload.fieldErrors?.[0]?.message || payload.message || "API request failed";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createClientId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function latestReferencePack(referencePacks: ReferencePack[], characterId: string) {
  return referencePacks
    .filter((item) => item.characterId === characterId)
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))[0];
}

function referencePacksForCharacter(referencePacks: ReferencePack[], characterId: string) {
  return referencePacks
    .filter((item) => item.characterId === characterId)
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt));
}

function backgroundPreviewDimensions(asset?: Asset | null) {
  if (!asset) return null;
  return { width: asset.width, height: asset.height };
}

function formatPercent(value: number) {
  return `${value}%`;
}

function subjectScaleImpactLabel(value: number) {
  if (value >= 138) return "Maximum influence";
  if (value >= 124) return "Strong influence";
  if (value >= 108) return "Medium influence";
  return "Light influence";
}

function uploadedAspectRatioHint(asset?: Asset | null) {
  if (!asset) return null;
  return `${asset.width} × ${asset.height}`;
}

function preparedImageAspectRatioHint(image?: PreparedUploadImage | null) {
  if (!image) return null;
  return `${image.width} × ${image.height}`;
}

function uploadFormatLabel(mimeType?: string) {
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/jpeg") return "JPEG";
  if (mimeType === "image/webp") return "WebP";
  return "Image";
}

const progressSteps: Array<{ status: Exclude<GenerationJob["status"], "failed">; label: string }> = [
  { status: "queued", label: "Submit" },
  { status: "analyzing-background", label: "Analyze Background" },
  { status: "preparing-references", label: "Prepare References" },
  { status: "rendering", label: "image generation" },
  { status: "completed", label: "Complete" },
];

const primaryCameraDistanceOptions = [
  {
    id: "auto-photo",
    label: "Auto Large",
    description: "Prefer waist-up or chest-up after reading the photo.",
    visualClassName: "is-auto",
  },
  {
    id: "full",
    label: "Full Body",
    description: "Show from head to toe.",
    visualClassName: "is-full",
  },
  {
    id: "medium",
    label: "Knee Up",
    description: "Crop the feet for a larger subject.",
    visualClassName: "is-knee-up",
  },
  {
    id: "waist-up",
    label: "Waist Up",
    description: "Larger than full body while staying natural.",
    visualClassName: "is-waist-up",
  },
  {
    id: "chest-up",
    label: "Chest Up",
    description: "Show the expression and upper outfit.",
    visualClassName: "is-chest-up",
  },
  {
    id: "shoulders-up",
    label: "Shoulders Up",
    description: "Make the face the focus.",
    visualClassName: "is-shoulders-up",
  },
] as const;

const primaryCameraDistanceIds: string[] = primaryCameraDistanceOptions.map((option) => option.id);

const subjectScalePresetOptions = [
  { value: 96, label: "Natural 96%", description: "Light influence", detail: "Blend into the background", visualClassName: "is-natural" },
  { value: 112, label: "Large 112%", description: "Medium influence", detail: "Recommended default", visualClassName: "is-large" },
  { value: 128, label: "Hero 128%", description: "Strong influence", detail: "Increase presence", visualClassName: "is-hero" },
  { value: 142, label: "Face First 142%", description: "Maximum influence", detail: "Prioritize the face", visualClassName: "is-xlarge" },
] as const;

const primaryPlacementOptions = [
  {
    id: "photo-auto",
    label: "Fit Photo",
    description: "Use the empty space for natural placement.",
    visualClassName: "is-placement-auto",
  },
  {
    id: "left-lower-foreground",
    label: "Lower Left",
    description: "Place large in the left foreground.",
    visualClassName: "is-placement-left-lower",
  },
  {
    id: "center",
    label: "Center",
    description: "Place the subject in the center.",
    visualClassName: "is-placement-center",
  },
  {
    id: "right-lower-foreground",
    label: "Lower Right",
    description: "Place large in the right foreground.",
    visualClassName: "is-placement-right-lower",
  },
] as const;

const primaryPlacementIds: string[] = primaryPlacementOptions.map((option) => option.id);

const primaryPoseOptions = [
  {
    id: "unspecified",
    label: "Auto",
    description: "Choose naturally from the photo.",
    visualClassName: "is-pose-auto",
  },
  {
    id: "natural-photo-pose",
    label: "Natural",
    description: "For everyday photos.",
    visualClassName: "is-pose-natural",
  },
  {
    id: "friends-photo-pose",
    label: "Friend Photo",
    description: "Easy to compose with others.",
    visualClassName: "is-pose-friends",
  },
  {
    id: "cute-pose",
    label: "Cute",
    description: "Soft and friendly.",
    visualClassName: "is-pose-cute",
  },
  {
    id: "cool-pose",
    label: "Cool",
    description: "Stronger silhouette.",
    visualClassName: "is-pose-cool",
  },
  {
    id: "playful-pose",
    label: "Playful",
    description: "Add lively movement.",
    visualClassName: "is-pose-playful",
  },
] as const;

const primaryPoseIds: string[] = primaryPoseOptions.map((option) => option.id);

const primaryExpressionOptions = [
  {
    id: "unspecified",
    label: "Auto",
    description: "Match the photo.",
    visualClassName: "is-expression-auto",
  },
  {
    id: "smile",
    label: "Smile",
    description: "A reliable default.",
    visualClassName: "is-expression-smile",
  },
  {
    id: "happy",
    label: "Happy",
    description: "For brighter photos.",
    visualClassName: "is-expression-happy",
  },
  {
    id: "cute-expression",
    label: "Cute",
    description: "Softer and sweeter.",
    visualClassName: "is-expression-cute",
  },
  {
    id: "cool-expression",
    label: "Cool",
    description: "Calm expression.",
    visualClassName: "is-expression-cool",
  },
  {
    id: "surprised",
    label: "Surprised",
    description: "Add a clear reaction.",
    visualClassName: "is-expression-surprised",
  },
] as const;

const primaryExpressionIds: string[] = primaryExpressionOptions.map((option) => option.id);

function progressStepState(currentStatus: GenerationJob["status"] | undefined, stepStatus: typeof progressSteps[number]["status"]) {
  const safeStatus = currentStatus === "failed" ? "rendering" : currentStatus ?? "queued";
  const currentIndex = progressSteps.findIndex((step) => step.status === safeStatus);
  const stepIndex = progressSteps.findIndex((step) => step.status === stepStatus);

  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "pending";
}

export function GenerationStudio({
  characters,
  isAnonymous = false,
  isSignedIn = true,
  referencePacks,
  sceneTemplates,
  initialCharacterId,
  initialJobPayload,
  initialJobMode = "variation",
  initialTemporaryReferenceAssetId,
  initialTemporaryReferenceAsset,
  initialTemporaryReferenceCharacterId,
}: GenerationStudioProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectFileRunIdRef = useRef(0);
  const selectBatchRunIdRef = useRef(0);
  const pollingJobIdRef = useRef<string | null>(null);
  const batchPreviewUrlsRef = useRef<Set<string>>(new Set());
  const inheritAsVariation = initialJobMode === "variation";
  const defaultCharacter =
    characters.find((item) => item.id === initialJobPayload?.job.characterId) ??
    characters.find((item) => item.id === initialCharacterId) ??
    characters[0];
  const initialCompositeCharacterIds = initialJobPayload?.job
    ? resolveCompositeCharacterIds(requestFromJob(initialJobPayload.job, { inheritAsVariation }))
    : defaultCharacter?.id
      ? [defaultCharacter.id]
      : [];
  const [characterList, setCharacterList] = useState(characters);
  const [referencePackList, setReferencePackList] = useState(referencePacks);
  const [selectedCharacterId, setSelectedCharacterId] = useState(defaultCharacter?.id ?? "");
  const [referencePackSelection, setReferencePackSelection] = useState<Record<string, string>>(
    buildReferencePackSelectionMap(initialCompositeCharacterIds, characters, referencePacks, initialJobPayload?.job),
  );
  const [mode, setMode] = useState<GenerationMode>(initialJobPayload?.job.mode ?? "photo-composite");
  const [request, setRequest] = useState<GenerationRequestInput>(
    initialJobPayload?.job
      ? requestFromJob(initialJobPayload.job, { inheritAsVariation })
      : defaultRequest(defaultCharacter?.id ?? ""),
  );
  const [file, setFile] = useState<File | null>(null);
  const [preparedImage, setPreparedImage] = useState<PreparedUploadImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [backgroundAsset, setBackgroundAsset] = useState<Asset | null>(initialJobPayload?.backgroundAsset ?? null);
  const [backgroundPreviewDimensionsState, setBackgroundPreviewDimensionsState] = useState(
    backgroundPreviewDimensions(initialJobPayload?.backgroundAsset),
  );
  const [activeJob, setActiveJob] = useState<GenerationJobPayload | null>(initialJobPayload ?? null);
  const [lastRequest, setLastRequest] = useState<GenerationRequestInput | null>(
    initialJobPayload?.job ? requestFromJob(initialJobPayload.job, { inheritAsVariation }) : null,
  );
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isPreparingBatchImages, setIsPreparingBatchImages] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isRegeneratingPack, setIsRegeneratingPack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);
  const [batchPhotos, setBatchPhotos] = useState<BatchPhotoItem[]>([]);
  const [showAnonymousPrompt, setShowAnonymousPrompt] = useState(false);
  const [hasManualSubjectScale, setHasManualSubjectScale] = useState(Boolean(initialJobPayload?.job));
  const [generationPreflight, setGenerationPreflight] = useState<GenerationPreflightState | null>(null);
  const [temporaryReference, setTemporaryReference] = useState<TemporaryReferenceState | null>(
    initialTemporaryReferenceAssetId && initialTemporaryReferenceCharacterId
      ? {
          assetId: initialTemporaryReferenceAssetId,
          asset: initialTemporaryReferenceAsset,
          characterId: initialTemporaryReferenceCharacterId,
        }
      : null,
  );

  const compositeCharacterIds = resolveCompositeCharacterIds(request);
  const selectedCharacters = compositeCharacterIds.flatMap((characterId) => {
    const matchingCharacter = characterList.find((item) => item.id === characterId);
    return matchingCharacter ? [matchingCharacter] : [];
  });
  const addableCharacters = characterList.filter((character) => !compositeCharacterIds.includes(character.id));
  const nextAddCharacterId = addableCharacters.some((character) => character.id === selectedCharacterId)
    ? selectedCharacterId
    : addableCharacters[0]?.id ?? "";
  const leadCharacter = selectedCharacters[0] ?? defaultCharacter;
  const selectedCharacter =
    characterList.find((item) => item.id === selectedCharacterId) ?? characterList[0];
  const characterReferencePacks = referencePacksForCharacter(referencePackList, selectedCharacter?.id ?? "");
  const defaultReferencePack =
    characterReferencePacks.find((item) => item.id === selectedCharacter?.referencePackId) ??
    characterReferencePacks[0];
  const activeReferencePack =
    characterReferencePacks.find((item) => item.id === referencePackSelection[selectedCharacter?.id ?? ""]) ??
    defaultReferencePack;
  const backgroundPreviewUrl = previewUrl ?? backgroundAsset?.imageUrl ?? null;
  const canSelectInputAspectRatio = mode === "photo-composite";
  const inputAspectRatioHint = preparedImageAspectRatioHint(preparedImage) ?? uploadedAspectRatioHint(backgroundAsset);
  const canSubmitGeneration = isSignedIn || Boolean(characterList.length);
  const activeTemporaryReference = temporaryReference?.characterId === request.characterId
    ? temporaryReference
    : null;
  const selectedBatchCharacterIds = selectedCharacters.map((character) => character.id);
  const runnableBatchPhotos = batchPhotos.filter((item) => item.status !== "completed");
  const batchCompletedCount = batchPhotos.filter((item) => item.status === "completed").length;
  const batchFailedCount = batchPhotos.filter((item) => item.status === "failed").length;
  const selectedBackgroundPhotoCount = batchPhotos.length || (backgroundPreviewUrl ? 1 : 0);
  const hasMultipleBackgroundPhotos = batchPhotos.length > 1;
  const isPreparingBackgroundPhotos = isPreparingImage || isPreparingBatchImages;
  const canSubmitPrimaryGeneration = hasMultipleBackgroundPhotos
    ? !isBatchRunning &&
      !isPreparingBackgroundPhotos &&
      runnableBatchPhotos.length > 0 &&
      selectedBatchCharacterIds.length > 0
    : canSubmitGeneration;
  const primaryGenerationLabel = isPreparingBackgroundPhotos
    ? "Compressing images..."
    : isBatchRunning
      ? "Generating batch..."
      : isGenerating
        ? "Generating..."
        : hasMultipleBackgroundPhotos
          ? `Generate ${runnableBatchPhotos.length || batchPhotos.length} selected photos`
          : request.variationOfJobId
            ? "Generate Variation"
            : "Generate Image";
  const rareCameraDistanceOptions = catalog.cameraDistances.filter(
    (option) => !primaryCameraDistanceIds.includes(option.id),
  );
  const rareCameraDistanceValue = primaryCameraDistanceIds.includes(request.cameraDistance) ? "" : request.cameraDistance;
  const rarePlacementOptions = catalog.placements.filter((option) => !primaryPlacementIds.includes(option.id));
  const rarePlacementValue = primaryPlacementIds.includes(request.placement) ? "" : request.placement;
  const rarePoseOptions = catalog.poses.filter((option) => !primaryPoseIds.includes(option.id));
  const rarePoseValue = primaryPoseIds.includes(request.pose) ? "" : request.pose;
  const rareExpressionOptions = catalog.expressions.filter((option) => !primaryExpressionIds.includes(option.id));
  const rareExpressionValue = primaryExpressionIds.includes(request.expression) ? "" : request.expression;
  const activeSubjectScalePreset = subjectScalePresetOptions.find((option) => option.value === request.subjectScale);
  const activeSubjectScaleHint = activeSubjectScalePreset
    ? `${activeSubjectScalePreset.label}: ${activeSubjectScalePreset.description} / ${activeSubjectScalePreset.detail}`
    : `Fine-tuning: ${formatPercent(request.subjectScale)} / ${subjectScaleImpactLabel(request.subjectScale)}`;
  const activeLandscapeScaleRecommendation = backgroundPreviewDimensionsState
    ? recommendedSubjectScaleForImage(backgroundPreviewDimensionsState.width, backgroundPreviewDimensionsState.height)
    : null;
  const landscapeSubjectScaleHint =
    !hasManualSubjectScale && activeLandscapeScaleRecommendation && request.subjectScale >= activeLandscapeScaleRecommendation
      ? ` Automatically raised to ${formatPercent(activeLandscapeScaleRecommendation)} or higher for a landscape photo.`
      : "";

  useEffect(() => {
    if (!selectedCharacter) return;
    const availableReferencePacks = referencePacksForCharacter(referencePackList, selectedCharacter.id);
    const fallbackReferencePackId =
      referencePackSelection[selectedCharacter.id] ??
      selectedCharacter.referencePackId ??
      availableReferencePacks[0]?.id ??
      "";

    if (!fallbackReferencePackId) {
      return;
    }

    setReferencePackSelection((current) =>
      current[selectedCharacter.id] &&
      availableReferencePacks.some((pack) => pack.id === current[selectedCharacter.id])
        ? current
        : { ...current, [selectedCharacter.id]: fallbackReferencePackId },
    );
  }, [referencePackList, referencePackSelection, selectedCharacter]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const batchPreviewUrls = batchPreviewUrlsRef.current;
    return () => {
      for (const previewUrl of batchPreviewUrls) {
        URL.revokeObjectURL(previewUrl);
      }
      batchPreviewUrls.clear();
    };
  }, []);

  useEffect(() => {
    if (!temporaryReference) return;
    if (temporaryReference.characterId === request.characterId) return;
    setTemporaryReference(null);
  }, [request.characterId, temporaryReference]);

  useEffect(() => {
    if (previewUrl) return;
    setBackgroundPreviewDimensionsState(backgroundPreviewDimensions(backgroundAsset));
  }, [backgroundAsset, previewUrl]);

  useEffect(() => {
    if (request.aspectRatio !== "match-input" || mode === "photo-composite") {
      return;
    }

    setRequest((current) =>
      current.aspectRatio === "match-input"
        ? { ...current, aspectRatio: "4:5" }
        : current,
    );
  }, [mode, request.aspectRatio]);

  useEffect(() => {
    if (!completedJobId) return;

    const destination = `/result/${completedJobId}`;
    const fallbackTimer = window.setTimeout(() => {
      window.location.assign(destination);
    }, 1600);

    router.push(destination);

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [completedJobId, router]);

  const progressStatus = activeJob?.job.status;
  const batchProgressProviderLabel =
    isBatchRunning && batchPhotos.some((item) => renderProviderLabel(item.provider)) ? "User Codex" : null;
  const progressProviderLabel =
    activeJob?.job ? renderProviderLabel(activeJob.job.provider) : batchProgressProviderLabel;
  const showProgressScreen = Boolean(
    isGenerating ||
      isInProgress(progressStatus) ||
      (progressStatus === "completed" && completedJobId === activeJob?.job.id),
  );
  const showPreflightModal = Boolean(generationPreflight);

  useEffect(() => {
    if (!showProgressScreen && !showPreflightModal) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showPreflightModal, showProgressScreen]);

  function resolveReferencePackIdForCharacter(characterId: string) {
    const availableReferencePacks = referencePacksForCharacter(referencePackList, characterId);
    return (
      referencePackSelection[characterId] ??
      characterList.find((item) => item.id === characterId)?.referencePackId ??
      availableReferencePacks[0]?.id ??
      ""
    );
  }

  function syncCompositeCharacters(nextCharacterIds: string[]) {
    const normalizedCharacterIds = uniqueIds(nextCharacterIds).slice(0, MAX_COMPOSITE_CHARACTERS);
    const nextLeadCharacterId = normalizedCharacterIds[0] ?? "";

    setRequest((current) => {
      const leadChanged = current.characterId !== nextLeadCharacterId;
      return {
        ...current,
        characterId: nextLeadCharacterId,
        characterIds: normalizedCharacterIds,
        referencePackId: resolveReferencePackIdForCharacter(nextLeadCharacterId) || undefined,
        referencePackIds: normalizedCharacterIds.map((characterId) => resolveReferencePackIdForCharacter(characterId)),
        outfitOverride: leadChanged ? "unspecified" : current.outfitOverride,
        outfitOverrideCustomText: leadChanged ? "" : current.outfitOverrideCustomText,
      };
    });
  }

  function addCompositeCharacter(characterId?: string) {
    const targetCharacterId =
      characterId && !compositeCharacterIds.includes(characterId)
        ? characterId
        : addableCharacters[0]?.id;

    if (!targetCharacterId) return;

    syncCompositeCharacters([...compositeCharacterIds, targetCharacterId]);
    setSelectedCharacterId(targetCharacterId);
  }

  function updateCompositeCharacterAt(index: number, characterId: string) {
    if (!characterId) return;
    const nextCharacterIds = [...compositeCharacterIds];
    nextCharacterIds[index] = characterId;
    setSelectedCharacterId(characterId);
    syncCompositeCharacters(nextCharacterIds);
  }

  function removeCompositeCharacterAt(index: number) {
    if (index === 0 || compositeCharacterIds.length <= 1) return;
    const removedCharacterId = compositeCharacterIds[index];
    const nextCharacterIds = compositeCharacterIds.filter((_, currentIndex) => currentIndex !== index);
    if (selectedCharacterId === removedCharacterId) {
      setSelectedCharacterId(nextCharacterIds[0] ?? characterList[0]?.id ?? "");
    }
    syncCompositeCharacters(nextCharacterIds);
  }

  function revokeBatchPreviewUrl(previewUrl: string) {
    URL.revokeObjectURL(previewUrl);
    batchPreviewUrlsRef.current.delete(previewUrl);
  }

  function createBatchPhotoItem(preparedImage: PreparedUploadImage): BatchPhotoItem {
    const previewUrl = URL.createObjectURL(preparedImage.file);
    batchPreviewUrlsRef.current.add(previewUrl);

    return {
      id: createClientId("batch"),
      file: preparedImage.file,
      preparedImage,
      previewUrl,
      status: "ready",
    };
  }

  function applyLandscapeSubjectScaleFloor(
    current: GenerationRequestInput,
    width: number,
    height: number,
  ): GenerationRequestInput {
    if (hasManualSubjectScale || current.mode !== "photo-composite") {
      return current;
    }

    const recommendedScale = recommendedSubjectScaleForImage(width, height);
    if (!recommendedScale || current.subjectScale >= recommendedScale) {
      return current;
    }

    return {
      ...current,
      subjectScale: recommendedScale,
    };
  }

  function setSingleBackgroundImage(nextPreparedImage: PreparedUploadImage) {
    setFile(nextPreparedImage.file);
    setPreparedImage(nextPreparedImage);
    setBackgroundAsset(null);
    setBackgroundPreviewDimensionsState({
      width: nextPreparedImage.width,
      height: nextPreparedImage.height,
    });
    setRequest((current) => ({
      ...applyLandscapeSubjectScaleFloor(current, nextPreparedImage.width, nextPreparedImage.height),
      assetId: undefined,
      aspectRatio: "match-input",
    }));

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(nextPreparedImage.file));
  }

  function updateBatchPhoto(itemId: string, patch: Partial<BatchPhotoItem>) {
    setBatchPhotos((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  }

  function clearBatchPhotos() {
    if (isBatchRunning) return;
    setBatchPhotos((current) => {
      for (const item of current) {
        revokeBatchPreviewUrl(item.previewUrl);
      }
      return [];
    });
    setBatchMessage(null);
  }

  function removeBatchPhoto(itemId: string) {
    if (isBatchRunning || isPreparingBackgroundPhotos) return;

    const removedItem = batchPhotos.find((item) => item.id === itemId);
    if (!removedItem) return;

    const remainingItems = batchPhotos.filter((item) => item.id !== itemId);
    revokeBatchPreviewUrl(removedItem.previewUrl);
    setBatchPhotos(remainingItems);
    setBatchMessage(null);
    setGenerationPreflight(null);

    if (!remainingItems.length) {
      void handleSelectFile(null);
      return;
    }

    const currentBackgroundWasRemoved =
      preparedImage === removedItem.preparedImage || file === removedItem.file;
    const currentBackgroundStillSelected = remainingItems.some(
      (item) => item.preparedImage === preparedImage || item.file === file,
    );

    if (currentBackgroundWasRemoved || !currentBackgroundStillSelected) {
      setSingleBackgroundImage(remainingItems[0].preparedImage);
    }
  }

  function clearBackgroundPhotos() {
    if (isBatchRunning) return;
    selectBatchRunIdRef.current += 1;
    setIsPreparingImage(false);
    setIsPreparingBatchImages(false);
    clearBatchPhotos();
    void handleSelectFile(null);
  }

  function buildSingleGenerationPreflight(nextRequest: GenerationRequestInput): GenerationPreflightState {
    const payloadCharacterIds = resolveCompositeCharacterIds(nextRequest);
    const payloadCharacters = payloadCharacterIds.flatMap((characterId) => {
      const matchingCharacter = characterList.find((item) => item.id === characterId);
      return matchingCharacter ? [matchingCharacter] : [];
    });
    const referencePackIds = payloadCharacterIds.map((characterId) => resolveReferencePackIdForCharacter(characterId));
    const missingReferenceNames = payloadCharacterIds.flatMap((characterId, index) => {
      if (referencePackIds[index]) return [];
      return characterList.find((item) => item.id === characterId)?.name ?? characterId;
    });
    const issues: PreflightIssue[] = [];
    const isPhotoComposite = mode === "photo-composite";
    const hasBackgroundPhoto = Boolean(nextRequest.assetId || backgroundAsset?.id || file);
    const backgroundName = isPhotoComposite
      ? hasBackgroundPhoto
        ? backgroundAsset?.name ?? preparedImage?.originalName ?? file?.name ?? "Selected Background Photo"
        : "Not selected"
      : sceneTemplateLabel(sceneTemplates, nextRequest);

    if (!payloadCharacterIds.length) {
      issues.push({ severity: "error", message: "No character is selected." });
    }

    if (missingReferenceNames.length) {
      issues.push({
        severity: "error",
        message: `Reference is not configured for ${shortList(missingReferenceNames)}.`,
      });
    }

    if (isPhotoComposite && !hasBackgroundPhoto) {
      issues.push({ severity: "error", message: "Photo composite mode requires a background photo." });
    }

    if (
      !isPhotoComposite &&
      nextRequest.sceneTemplateId === CUSTOM_SCENE_TEMPLATE_ID &&
      !nextRequest.sceneTemplateCustomText?.trim()
    ) {
      issues.push({ severity: "error", message: "Scene template is set to custom text, but the text is empty." });
    }

    pushCustomTextIssue(issues, "Body Posture", nextRequest.bodyPosture, nextRequest.bodyPostureCustomText);
    pushCustomTextIssue(issues, "Pose", nextRequest.pose, nextRequest.poseCustomText);
    pushCustomTextIssue(issues, "Expression", nextRequest.expression, nextRequest.expressionCustomText);
    pushCustomTextIssue(issues, "Placement", nextRequest.placement, nextRequest.placementCustomText);
    pushCustomTextIssue(issues, "Outfit", nextRequest.outfitOverride, nextRequest.outfitOverrideCustomText);
    pushCustomTextIssue(
      issues,
      "Character rendering style",
      nextRequest.characterRenderStyle,
      nextRequest.characterRenderStyleCustomText,
    );

    if (!isPhotoComposite || !nextRequest.preserveBackgroundPhoto) {
      pushCustomTextIssue(
        issues,
        "Background rendering style",
        nextRequest.backgroundRenderStyle,
        nextRequest.backgroundRenderStyleCustomText,
      );
    }

    if (
      temporaryReference?.assetId &&
      temporaryReference.characterId === nextRequest.characterId
    ) {
      issues.push({ severity: "warning", message: "One temporary consistency reference will be added for this generation." });
    }

    return {
      kind: "single",
      request: nextRequest,
      title: "Preflight Check",
      confirmLabel: nextRequest.variationOfJobId ? "Generate Variation" : "Generate Image",
      summary: [
        { label: "Mode", value: isPhotoComposite ? "Photo Composite" : "Scene Template" },
        { label: "Characters", value: shortList(payloadCharacters.map((character) => character.name)) },
        { label: "Background", value: backgroundName },
        { label: "Framing", value: getOption(catalog.cameraDistances, nextRequest.cameraDistance).label },
        {
          label: "Placement/Size",
          value: `${resolveGenerationFieldOption(nextRequest, "placement").label} / ${formatPercent(nextRequest.subjectScale)}`,
        },
        { label: "Reference", value: `${referencePackIds.filter(Boolean).length}/${payloadCharacterIds.length || 0}` },
        { label: "Aspect Ratio", value: getOption(catalog.aspectRatios, nextRequest.aspectRatio).label },
        {
          label: "Access",
          value: isSignedIn ? "Signed-in user" : "Anonymous studio generation, one time",
        },
      ],
      issues,
    };
  }

  function buildBatchGenerationPreflight(): GenerationPreflightState {
    const targetItems = batchPhotos.filter((item) => item.status !== "completed");
    const characterIds = selectedBatchCharacterIds;
    const characterNames = characterIds.flatMap((characterId) => {
      const matchingCharacter = characterList.find((item) => item.id === characterId);
      return matchingCharacter ? [matchingCharacter.name] : [];
    });
    const referencePackIds = characterIds.map((characterId) => resolveReferencePackIdForCharacter(characterId));
    const missingReferenceNames = characterIds.flatMap((characterId, index) => {
      if (referencePackIds[index]) return [];
      return characterList.find((item) => item.id === characterId)?.name ?? characterId;
    });
    const issues: PreflightIssue[] = [];

    if (!isSignedIn) {
      issues.push({ severity: "error", message: "Batch background generation is available after sign-in." });
    }
    if (!targetItems.length) {
      issues.push({ severity: "error", message: "No background photos are ready to process." });
    }
    if (!characterIds.length) {
      issues.push({ severity: "error", message: "Create a character first." });
    }
    if (missingReferenceNames.length) {
      issues.push({
        severity: "error",
        message: `Reference is not configured for ${shortList(missingReferenceNames)}.`,
      });
    }
    if (batchCompletedCount) {
      issues.push({
        severity: "warning",
        message: `${batchCompletedCount} completed items will be skipped.`,
      });
    }

    return {
      kind: "batch",
      title: "Batch Preflight Check",
      confirmLabel: "Generate Selected Photos",
      summary: [
        { label: "Photos", value: `${targetItems.length}` },
        { label: "Characters", value: `${characterIds.length} / ${shortList(characterNames)}` },
        { label: "Reference", value: `${referencePackIds.filter(Boolean).length}/${characterIds.length || 0}` },
        { label: "Background Processing", value: "Auto placement per photo" },
        { label: "Composition Diversity", value: targetItems.length > 1 ? "Auto per photo" : "None" },
        { label: "Framing", value: getOption(catalog.cameraDistances, request.cameraDistance).label },
        { label: "Size", value: formatPercent(request.subjectScale) },
      ],
      issues,
    };
  }

  function requestBatchGeneration() {
    setError(null);
    setShowAnonymousPrompt(false);
    setBatchMessage(null);
    setGenerationPreflight(buildBatchGenerationPreflight());
  }

  function requestPrimaryGeneration() {
    if (hasMultipleBackgroundPhotos) {
      requestBatchGeneration();
      return;
    }

    requestGeneration();
  }

  async function confirmPreflightGeneration() {
    const currentPreflight = generationPreflight;
    if (!currentPreflight || currentPreflight.issues.some((issue) => issue.severity === "error")) {
      return;
    }

    setGenerationPreflight(null);

    if (currentPreflight.kind === "single") {
      await submitGeneration(currentPreflight.request);
      return;
    }

    await runBatchGeneration();
  }

  async function handleSelectBackgroundFiles(selectedFiles: FileList | File[] | null) {
    const files = Array.from(selectedFiles ?? []);
    if (!files.length) {
      void handleSelectFile(null);
      return;
    }

    const targetFiles = files.slice(0, MAX_BATCH_PHOTOS);
    const fileRunId = selectFileRunIdRef.current + 1;
    const batchRunId = selectBatchRunIdRef.current + 1;
    selectFileRunIdRef.current = fileRunId;
    selectBatchRunIdRef.current = batchRunId;
    setError(null);
    setBatchMessage(null);
    setIsPreparingImage(true);
    setIsPreparingBatchImages(true);

    const nextItems: BatchPhotoItem[] = [];
    let didCommitItems = false;

    try {
      for (const selectedFile of targetFiles) {
        const nextPreparedImage = await prepareImageForUpload(selectedFile);
        if (selectFileRunIdRef.current !== fileRunId || selectBatchRunIdRef.current !== batchRunId) {
          return;
        }

        nextItems.push(createBatchPhotoItem(nextPreparedImage));
      }

      if (nextItems[0]) {
        setSingleBackgroundImage(nextItems[0].preparedImage);
      }
      setBatchPhotos((current) => {
        for (const item of current) {
          revokeBatchPreviewUrl(item.previewUrl);
        }
        return nextItems;
      });
      didCommitItems = true;
      if (files.length > targetFiles.length) {
        setBatchMessage(`Only ${targetFiles.length} photos were added because the batch limit was reached.`);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to prepare the background photo.");
    } finally {
      if (!didCommitItems) {
        for (const item of nextItems) {
          revokeBatchPreviewUrl(item.previewUrl);
        }
      }
      if (selectFileRunIdRef.current === fileRunId) {
        setIsPreparingImage(false);
      }
      if (selectBatchRunIdRef.current === batchRunId) {
        setIsPreparingBatchImages(false);
      }
    }
  }

  function buildAutoBatchRequest(
    assetId: string,
    characterIds: string[],
    item: BatchPhotoItem,
    batchIndex: number,
    batchTotal: number,
    batchGroupId: string,
  ): GenerationRequestInput {
    const photoShape =
      item.preparedImage.width > item.preparedImage.height
        ? "landscape photo"
        : item.preparedImage.width < item.preparedImage.height
          ? "portrait photo"
          : "near-square photo";
    const referencePackIds = characterIds.map((characterId) => resolveReferencePackIdForCharacter(characterId));
    const diversityPreset = batchCompositionPresets[batchIndex % batchCompositionPresets.length];
    const shouldDivergeComposition = batchTotal > 1;
    const shouldAutoFrame = request.cameraDistance === "unspecified" || request.cameraDistance === "auto-photo";
    const shouldAutoPlace = request.placement === "unspecified" || request.placement === "photo-auto";
    const resolvedCameraDistance = shouldAutoFrame ? diversityPreset.cameraDistance : request.cameraDistance;
    const resolvedPlacement = shouldAutoPlace ? diversityPreset.placement : request.placement;
    const itemRecommendedScale = recommendedSubjectScaleForImage(item.preparedImage.width, item.preparedImage.height);
    const baseSubjectScale =
      !hasManualSubjectScale && itemRecommendedScale
        ? Math.max(request.subjectScale, itemRecommendedScale)
        : request.subjectScale;
    const resolvedSubjectScale = shouldDivergeComposition
      ? clampSubjectScale(baseSubjectScale + diversityPreset.subjectScaleOffset)
      : baseSubjectScale;
    const batchDiversityDirection = shouldDivergeComposition
      ? `Batch generation ${batchIndex + 1}/${batchTotal}. Composition type: ${diversityPreset.label}. Avoid matching camera distance, placement, face size, and body crop with the other simultaneous generations.`
      : "";

    return {
      ...request,
      characterId: characterIds[0],
      characterIds,
      referencePackId: referencePackIds[0] || undefined,
      referencePackIds,
      batchGroupId,
      mode: "photo-composite",
      assetId,
      variationOfJobId: undefined,
      temporaryReferenceAssetIds: undefined,
      aspectRatio: "match-input",
      bodyPosture: CUSTOM_GENERATION_OPTION_ID,
      bodyPostureCustomText: [
        `Read the empty space, floor, furniture, and sightline in the ${photoShape}; prioritize a posture where the face and expression appear naturally large.`,
        "Use full-body standing only when the photo actually needs it.",
        batchDiversityDirection,
        shouldDivergeComposition ? diversityPreset.bodyPostureDirection : "",
      ].filter(Boolean).join(". "),
      pose: CUSTOM_GENERATION_OPTION_ID,
      poseCustomText: [
        "Automatically choose a natural pose that matches the photo mood and keeps the face and expression readable.",
        "Even with multiple characters, do not default to a tiny full-body group; include full bodies only when needed.",
        shouldDivergeComposition ? diversityPreset.poseDirection : "",
      ].filter(Boolean).join(". "),
      expression: request.expression === "unspecified" ? "happy" : request.expression,
      expressionCustomText: request.expression === "unspecified" ? "" : request.expressionCustomText,
      cameraDistance: resolvedCameraDistance,
      placement: resolvedPlacement,
      placementCustomText: shouldAutoPlace ? "" : request.placementCustomText,
      backgroundCrop: { zoom: 100, focusX: 0, focusY: 0 },
      subjectAnchor: "unspecified",
      subjectScale: resolvedSubjectScale,
      depthLayer: "unspecified",
      lightingMode: "match-background",
      occlusionMode: "soft-foreground",
      fitToPhotoContent: true,
      preserveBackgroundPhoto: true,
      consistencyMode: "strict",
    };
  }

  async function handleSelectFile(selected: File | null) {
    const runId = selectFileRunIdRef.current + 1;
    selectFileRunIdRef.current = runId;

    setFile(null);
    setPreparedImage(null);
    setBackgroundAsset(null);
    setBackgroundPreviewDimensionsState(null);
    setRequest((current) => ({
      ...current,
      assetId: undefined,
      aspectRatio: selected ? "match-input" : current.aspectRatio,
    }));
    setError(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);

    if (!selected) {
      return;
    }

    setIsPreparingImage(true);

    try {
      const nextPreparedImage = await prepareImageForUpload(selected);
      if (selectFileRunIdRef.current !== runId) {
        return;
      }

      setFile(nextPreparedImage.file);
      setPreparedImage(nextPreparedImage);
      setBackgroundPreviewDimensionsState({
        width: nextPreparedImage.width,
        height: nextPreparedImage.height,
      });
      setPreviewUrl(URL.createObjectURL(nextPreparedImage.file));
      setRequest((current) => applyLandscapeSubjectScaleFloor(current, nextPreparedImage.width, nextPreparedImage.height));
      setBatchPhotos((current) => (current.length ? current : [createBatchPhotoItem(nextPreparedImage)]));
    } catch (caughtError) {
      if (selectFileRunIdRef.current === runId) {
        setFile(null);
        setPreparedImage(null);
        setError(caughtError instanceof Error ? caughtError.message : "Failed to compress the image.");
      }
    } finally {
      if (selectFileRunIdRef.current === runId) {
        setIsPreparingImage(false);
      }
    }
  }

  const pollJob = useCallback(async (jobId: string) => {
    if (pollingJobIdRef.current === jobId) return;
    pollingJobIdRef.current = jobId;

    try {
      let finished = false;
      while (!finished) {
        const response = await fetch(`/api/generations/${jobId}`);
        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
        const payload = (await response.json()) as GenerationJobPayload;
        setActiveJob(payload);
        finished = payload.job.status === "completed" || payload.job.status === "failed";
        if (!finished) {
          await new Promise((resolve) => window.setTimeout(resolve, 800));
        } else if (payload.job.status === "completed") {
          setCompletedJobId(payload.job.id);
        } else {
          setError(payload.job.failureReason ?? "Generation failed.");
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to check generation status.");
    } finally {
      if (pollingJobIdRef.current === jobId) {
        pollingJobIdRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const job = activeJob?.job;
    if (!job || !isInProgress(job.status) || isGenerating) return;
    void pollJob(job.id);
  }, [activeJob?.job, isGenerating, pollJob]);

  async function pollBatchJob(itemId: string, jobId: string) {
    let finished = false;

    while (!finished) {
      const response = await fetch(`/api/generations/${jobId}`);
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as GenerationJobPayload;
      const status = payload.job.status;
      finished = status === "completed" || status === "failed";

      updateBatchPhoto(itemId, {
        status: status === "completed" ? "completed" : status === "failed" ? "failed" : "rendering",
        jobId: payload.job.id,
        provider: payload.job.provider,
        error: status === "failed" ? payload.job.failureReason ?? "Generation failed." : undefined,
      });

      if (!finished) {
        await sleep(900);
      }
    }
  }

  async function runBatchGeneration() {
    const targetItems = batchPhotos.filter((item) => item.status !== "completed");
    const characterIds = selectedBatchCharacterIds;

    if (!isSignedIn) {
      setError("Batch background generation is available after sign-in.");
      return;
    }
    if (!targetItems.length) {
      setError("Select background photos to process.");
      return;
    }
    if (!characterIds.length) {
      setError("Create a character first.");
      return;
    }

    setError(null);
    setBatchMessage(null);
    setIsBatchRunning(true);

    const createdJobs: Array<{ itemId: string; jobId: string }> = [];
    let failedCount = 0;
    const batchGroupId = createClientId("batch_run");

    try {
      for (const [batchIndex, item] of targetItems.entries()) {
        try {
          updateBatchPhoto(item.id, { status: "uploading", error: undefined });

          const formData = new FormData();
          formData.append("file", item.file);
          const uploadResponse = await fetch("/api/assets/upload", { method: "POST", body: formData });
          if (!uploadResponse.ok) {
            throw new Error(await readApiError(uploadResponse));
          }
          const uploaded = (await uploadResponse.json()) as { asset: Asset };

          updateBatchPhoto(item.id, { assetId: uploaded.asset.id, status: "queued" });

          const createResponse = await fetch("/api/generations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildAutoBatchRequest(
              uploaded.asset.id,
              characterIds,
              item,
              batchIndex,
              targetItems.length,
              batchGroupId,
            )),
          });
          if (!createResponse.ok) {
            throw new Error(await readApiError(createResponse));
          }

          const created = (await createResponse.json()) as { job: GenerationJob };
          updateBatchPhoto(item.id, { status: "rendering", jobId: created.job.id, provider: created.job.provider });
          createdJobs.push({ itemId: item.id, jobId: created.job.id });
        } catch (caughtError) {
          failedCount += 1;
          updateBatchPhoto(item.id, {
            status: "failed",
            error: caughtError instanceof Error ? caughtError.message : "Batch background generation failed.",
          });
        }
      }

      const results = await Promise.allSettled(
        createdJobs.map((created) => pollBatchJob(created.itemId, created.jobId)),
      );
      failedCount += results.filter((result) => result.status === "rejected").length;

      for (const [index, result] of results.entries()) {
        if (result.status !== "rejected") continue;
        updateBatchPhoto(createdJobs[index].itemId, {
          status: "failed",
          error: result.reason instanceof Error ? result.reason.message : "Failed to check generation status.",
        });
      }

      setBatchMessage(
        failedCount
          ? `Batch generation completed with ${failedCount} failures.`
          : "Batch generation completed.",
      );
    } finally {
      setIsBatchRunning(false);
    }
  }

  async function submitGeneration(nextRequest?: GenerationRequestInput) {
    const payload = nextRequest ?? request;
    const payloadCharacterIds = resolveCompositeCharacterIds(payload);
    const resolvedReferencePackIds = payloadCharacterIds.map((characterId) => resolveReferencePackIdForCharacter(characterId));
    if (!payloadCharacterIds.length || !leadCharacter) {
      setError("Create a character first.");
      return;
    }

    setError(null);
    setShowAnonymousPrompt(false);
    setIsGenerating(true);

    try {
      let assetId = payload.assetId;
      let uploadedAsset: Asset | null = backgroundAsset;

      if (mode === "photo-composite") {
        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          const uploadResponse = await fetch("/api/assets/upload", { method: "POST", body: formData });
          if (!uploadResponse.ok) {
            throw new Error(await readApiError(uploadResponse));
          }
          const uploaded = (await uploadResponse.json()) as { asset: Asset };
          uploadedAsset = uploaded.asset;
          assetId = uploaded.asset.id;
          setBackgroundAsset(uploaded.asset);
        } else if (!assetId && !backgroundAsset?.id) {
          throw new Error("Select a background photo for photo composite mode.");
        } else {
          assetId = assetId ?? backgroundAsset?.id;
        }
      }

      const body = {
        ...payload,
        characterId: payloadCharacterIds[0],
        characterIds: payloadCharacterIds,
        mode,
        assetId,
        referencePackId: resolvedReferencePackIds[0],
        referencePackIds: resolvedReferencePackIds,
        temporaryReferenceAssetIds: activeTemporaryReference ? [activeTemporaryReference.assetId] : [],
        consistencyMode: "strict",
        subjectAnchor: "unspecified",
        lightingMode: mode === "photo-composite" ? "match-background" : "unspecified",
      } satisfies GenerationRequestInput;

      const createResponse = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!createResponse.ok) {
        throw new Error(await readApiError(createResponse));
      }
      const created = (await createResponse.json()) as { job: GenerationJob };
      const storedRequest = {
        ...body,
        assetId: uploadedAsset?.id ?? assetId,
        temporaryReferenceAssetIds: undefined,
      } satisfies GenerationRequestInput;
      setLastRequest(storedRequest);
      setRequest(storedRequest);
      setTemporaryReference(null);
      setActiveJob({
        job: created.job,
        backgroundAsset: uploadedAsset ?? backgroundAsset ?? undefined,
      });
      await pollJob(created.job.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  function requestGeneration(nextRequest?: GenerationRequestInput, options?: { allowAnonymous?: boolean }) {
    if (!isSignedIn && !options?.allowAnonymous) {
      setShowAnonymousPrompt(true);
      setError(null);
      return;
    }

    setError(null);
    setShowAnonymousPrompt(false);
    setGenerationPreflight(buildSingleGenerationPreflight(nextRequest ?? request));
  }

  async function regenerateReferencePack() {
    if (!selectedCharacter) return;
    setIsRegeneratingPack(true);
    setError(null);

    try {
      const response = await fetch(`/api/characters/${selectedCharacter.id}/reference-pack/generate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const payload = (await response.json()) as { referencePack: ReferencePack };
      setReferencePackList((current) => [
        payload.referencePack,
        ...current.filter((item) => item.id !== payload.referencePack.id),
      ]);
      setReferencePackSelection((current) => ({
        ...current,
        [selectedCharacter.id]: payload.referencePack.id,
      }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to regenerate references.");
    } finally {
      setIsRegeneratingPack(false);
    }
  }

  async function adoptReferencePack(referencePackId: string) {
    if (!selectedCharacter) return;
    setError(null);

    try {
      const response = await fetch(`/api/characters/${selectedCharacter.id}/reference-pack/select`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referencePackId }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      setCharacterList((current) =>
        current.map((character) =>
          character.id === selectedCharacter.id ? { ...character, referencePackId } : character,
        ),
      );
      setReferencePackSelection((current) => ({
        ...current,
        [selectedCharacter.id]: referencePackId,
      }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to adopt the reference.");
    }
  }

  async function clearConsistencyReferences() {
    if (!selectedCharacter) return;
    const confirmed = window.confirm(`Clear all adopted consistency references for "${selectedCharacter.name}"?`);
    if (!confirmed) return;

    setError(null);

    try {
      const response = await fetch(`/api/characters/${selectedCharacter.id}/consistency-references`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const payload = (await response.json()) as { character: CharacterSpec };
      setCharacterList((current) =>
        current.map((character) =>
          character.id === payload.character.id ? payload.character : character,
        ),
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to clear consistency references.");
    }
  }

  const isPortraitBackgroundPreview = Boolean(
    backgroundPreviewDimensionsState &&
      backgroundPreviewDimensionsState.height > backgroundPreviewDimensionsState.width,
  );

  function handleBackgroundPreviewLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    setBackgroundPreviewDimensionsState((current) => {
      if (current && current.width === naturalWidth && current.height === naturalHeight) {
        return current;
      }
      return { width: naturalWidth, height: naturalHeight };
    });
  }

  const preflightHasBlockingIssues = generationPreflight?.issues.some((issue) => issue.severity === "error") ?? false;

  return (
    <>
      {generationPreflight ? (
        <div
          aria-labelledby="generation-preflight-title"
          aria-modal="true"
          className="builder-generation-modal-backdrop generation-preflight-backdrop"
          role="dialog"
        >
          <div className="builder-generation-modal-card generation-preflight-card">
            <div className="builder-generation-modal-head">
              <div className="stack-xs">
                <span className="chip chip-soft">Preflight</span>
                <h2 className="heading-md" id="generation-preflight-title">
                  {generationPreflight.title}
                </h2>
              </div>
              <button
                aria-label="Close preflight check"
                className="btn-icon btn-icon-sm"
                type="button"
                onClick={() => setGenerationPreflight(null)}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M5 5l10 10" strokeLinecap="round" />
                  <path d="M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="generation-preflight-summary">
              {generationPreflight.summary.map((item) => (
                <div className="generation-preflight-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            {generationPreflight.issues.length ? (
              <div className="generation-preflight-issues">
                {generationPreflight.issues.map((issue) => (
                  <p
                    className={`generation-preflight-issue generation-preflight-issue-${issue.severity}`}
                    key={issue.message}
                  >
                    {issue.message}
                  </p>
                ))}
              </div>
            ) : (
              <p className="generation-preflight-ok">Ready to generate with these settings.</p>
            )}

            <div className="generation-preflight-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setGenerationPreflight(null)}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                disabled={preflightHasBlockingIssues || isGenerating || isBatchRunning}
                type="button"
                onClick={() => void confirmPreflightGeneration()}
              >
                {generationPreflight.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showProgressScreen ? (
        <div className="progress-overlay" aria-live="polite">
          <div className="progress-panel">
            <div className="progress-panel-header">
              <span className="chip chip-soft">Generation</span>
              <p className="progress-panel-caption">Track progress here.</p>
            </div>

            <div className="progress-spinner">
              <div className="progress-spinner-inner" />
            </div>

            <div className="stack-xs">
              <p className="progress-title">{formatStatus(progressStatus ?? "queued")}</p>
              <p className="progress-text">{progressDescription(progressStatus)}</p>
            </div>

            <div className="progress-step-list" aria-label="Generation steps">
              {progressSteps.map((step, index) => {
                const state = progressStepState(progressStatus, step.status);

                return (
                  <div className={`progress-step progress-step-${state}`} key={step.status}>
                    <span className="progress-step-index" aria-hidden="true">
                      {state === "done" ? "✓" : index + 1}
                    </span>
                    <span className="progress-step-label">{step.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="progress-meta">
              <span className="chip chip-soft">
                {leadCharacter
                  ? `${leadCharacter.name}${selectedCharacters.length > 1 ? ` +${selectedCharacters.length - 1}` : ""}`
                  : "Character"}
              </span>
              <span className="chip chip-sage">{mode === "scene-template" ? "Scene Template" : "Photo Composite"}</span>
              {progressProviderLabel ? <span className="chip chip-soft">{progressProviderLabel}</span> : null}
            </div>

            {completedJobId ? (
              <Link className="btn btn-secondary btn-sm progress-action" href={`/result/${completedJobId}`}>
                Open result page
              </Link>
            ) : (
              <div className="progress-fallback-actions">
                <p className="progress-footnote">If you return here, the app will recheck generation status. If it does not change for a while, the result may already be saved in Album.</p>
                <div className="btn-row">
                  {activeJob?.job.id ? (
                    <Link className="btn btn-secondary btn-sm" href={`/result/${activeJob.job.id}`}>
                      View Result
                    </Link>
                  ) : null}
                  {leadCharacter ? (
                    <Link className="btn btn-ghost btn-sm" href={`/album?characterId=${leadCharacter.id}`}>
                      View Album
                    </Link>
                  ) : (
                    <Link className="btn btn-ghost btn-sm" href="/album">
                      View Album
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="studio-layout">
        <div className="card card-padded">
          <div className="form-stack">
            <div className="field">
              <label className="field-label" htmlFor="character">Character</label>
              <div className="composite-character-stack">
                {compositeCharacterIds.map((characterId, index) => (
                  <div className="composite-character-row" key={`${index}-${characterId}`}>
                    <div className="field composite-character-field">
                      <label className="field-label" htmlFor={`character-${index}`}>
                        {index === 0 ? "Lead Character" : `Additional Character ${index}`}
                      </label>
                      <select
                        className="select"
                        id={`character-${index}`}
                        value={characterId}
                        onChange={(event) => updateCompositeCharacterAt(index, event.target.value)}
                        onFocus={() => setSelectedCharacterId(characterId)}
                      >
                        {characterOptionsForRow(characterList, compositeCharacterIds, index).map((character) => (
                          <option key={character.id} value={character.id}>{character.name}</option>
                        ))}
                      </select>
                    </div>
                    {index === 0 ? (
                      <button
                        aria-label="Add Character"
                        className="btn-icon composite-character-action"
                        disabled={
                          !nextAddCharacterId ||
                          compositeCharacterIds.length >= MAX_COMPOSITE_CHARACTERS
                        }
                        type="button"
                        onClick={() => addCompositeCharacter(nextAddCharacterId)}
                      >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path d="M10 4v12" strokeLinecap="round" />
                          <path d="M4 10h12" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        aria-label={`Additional Character${index} remove`}
                        className="btn-icon btn-icon-danger composite-character-action"
                        type="button"
                        onClick={() => removeCompositeCharacterAt(index)}
                      >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path d="M5 5l10 10" strokeLinecap="round" />
                          <path d="M15 5L5 15" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="field-hint">The first character is the lead. Press `+` to add another character selector.</p>
            </div>

            <div className="mode-toggle">
              <button
                className={`mode-toggle-btn ${mode === "scene-template" ? "is-active" : ""}`}
                type="button"
                onClick={() => setMode("scene-template")}
              >
                Scene Template
              </button>
              <button
                className={`mode-toggle-btn ${mode === "photo-composite" ? "is-active" : ""}`}
                type="button"
                onClick={() => setMode("photo-composite")}
              >
                Photo Composite
              </button>
            </div>

            {mode === "scene-template" ? (
              <div className="field">
                <label className="field-label" htmlFor="sceneTemplateId">Scene Template</label>
                <select
                  className="select"
                  id="sceneTemplateId"
                  value={request.sceneTemplateId ?? ""}
                  onChange={(event) =>
                    setRequest((current) => ({
                      ...current,
                      sceneTemplateId: event.target.value,
                      sceneTemplateCustomText:
                        event.target.value === CUSTOM_SCENE_TEMPLATE_ID ? current.sceneTemplateCustomText : "",
                    }))
                  }
                >
                  {sceneTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.category} / {template.label}
                    </option>
                  ))}
                  <option value={CUSTOM_SCENE_TEMPLATE_ID}>Custom Text</option>
                </select>
                {request.sceneTemplateId === CUSTOM_SCENE_TEMPLATE_ID ? (
                  <input
                    aria-label="Scene template custom text"
                    className="input"
                    placeholder="Describe the background mood or location"
                    type="text"
                    value={request.sceneTemplateCustomText ?? ""}
                    onChange={(event) =>
                      setRequest((current) => ({ ...current, sceneTemplateCustomText: event.target.value }))
                    }
                  />
                ) : null}
              </div>
            ) : (
              <>
              <div className="batch-panel background-photo-panel">
                <div className="field">
                  <div className="field-row">
                    <label className="field-label">Background Photo</label>
                    {(file || backgroundAsset || batchPhotos.length) ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={isPreparingBackgroundPhotos || isBatchRunning}
                        type="button"
                        onClick={clearBackgroundPhotos}
                      >
                        Remove Background Photo
                      </button>
                    ) : null}
                  </div>
                  <div className="chip-row">
                    <span className="chip chip-soft">Selected {selectedBackgroundPhotoCount} photos</span>
                    <span className="chip chip-soft">{hasMultipleBackgroundPhotos ? "Batch generation" : "Single generation"}</span>
                    <span className="chip chip-sage">Selected characters {selectedBatchCharacterIds.length} characters</span>
                  </div>
                  {backgroundPreviewUrl && !hasMultipleBackgroundPhotos ? (
                    <div className="stack-sm">
                      <div
                        className={`backdrop-preview backdrop-preview-stage ${
                          isPortraitBackgroundPreview ? "is-portrait" : "is-standard"
                        }`}
                      >
                        <div className="backdrop-preview-frame">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt="Background preview"
                            src={backgroundPreviewUrl}
                            onLoad={handleBackgroundPreviewLoad}
                          />
                        </div>
                      </div>
                      <div className="chip-row">
                        <span className="chip chip-soft">
                          {backgroundAsset?.name ?? preparedImage?.originalName ?? file?.name ?? "Selected background"}
                        </span>
                        {preparedImage?.wasOptimized ? (
                          <span className="chip chip-sage">
                            {formatFileSize(preparedImage.originalSize)} → {formatFileSize(preparedImage.optimizedSize)}
                          </span>
                        ) : null}
                      </div>
                      {preparedImage ? (
                        <p className="field-hint">
                          {preparedImage.width} × {preparedImage.height}
                          {preparedImage.wasOptimized
                            ? ` and will send as ${uploadFormatLabel(preparedImage.outputMimeType)}.`
                            : ` and will send as ${uploadFormatLabel(preparedImage.outputMimeType)}.`}
                        </p>
                      ) : null}
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        disabled={isPreparingBackgroundPhotos}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Choose another photo
                      </button>
                    </div>
                  ) : !backgroundPreviewUrl ? (
                    <div
                      className="upload-zone"
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17,8 12,3 7,8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span className="text-sm">Select one or more background photos</span>
                    </div>
                  ) : null}
                  {isPreparingBackgroundPhotos ? <p className="field-hint">Compressing background images for upload...</p> : null}
                  <input
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp"
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => {
                      const selectedFiles = Array.from(event.currentTarget.files ?? []);
                      void handleSelectBackgroundFiles(selectedFiles);
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
                {batchPhotos.length ? (
                  <div className="background-photo-list-section">
                    <div className="field-row">
                      <p className="form-section-title">
                        {hasMultipleBackgroundPhotos ? "Selected Background Photos" : "Selected Background"}
                      </p>
                      <div className="chip-row">
                        {hasMultipleBackgroundPhotos ? <span className="chip chip-soft">Review {batchPhotos.length} photos</span> : null}
                        {batchCompletedCount ? <span className="chip chip-sage">Complete {batchCompletedCount} items</span> : null}
                        {batchFailedCount ? <span className="chip chip-soft batch-chip-error">Failure {batchFailedCount} items</span> : null}
                      </div>
                    </div>
                    <div className="batch-photo-grid">
                      {batchPhotos.map((item) => {
                        const itemProviderLabel = renderProviderLabel(item.provider);

                        return (
                          <div className={`batch-photo-card batch-photo-card-${item.status}`} key={item.id}>
                            <div className="batch-photo-preview">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img alt={item.preparedImage.originalName} src={item.previewUrl} />
                            </div>
                            <div className="batch-photo-meta">
                              <div className="batch-photo-title-row">
                                <p className="reference-upload-name">{item.preparedImage.originalName}</p>
                                <button
                                  aria-label={`${item.preparedImage.originalName} delete`}
                                  className="btn-icon btn-icon-danger btn-icon-sm batch-photo-remove-button"
                                  disabled={isPreparingBackgroundPhotos || isBatchRunning}
                                  title="Delete this photo"
                                  type="button"
                                  onClick={() => removeBatchPhoto(item.id)}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                  </svg>
                                </button>
                              </div>
                              <div className="chip-row">
                                <span className="chip chip-soft">{item.preparedImage.width} × {item.preparedImage.height}</span>
                                <span className={item.status === "failed" ? "chip chip-soft batch-chip-error" : "chip chip-sage"}>
                                  {batchPhotoStatusLabel(item.status)}
                                </span>
                                {itemProviderLabel ? <span className="chip chip-soft">{itemProviderLabel}</span> : null}
                              </div>
                              {item.error ? <p className="error-text batch-photo-error">{item.error}</p> : null}
                              {item.jobId ? (
                                <div className="btn-row">
                                  <Link className="btn btn-ghost btn-sm" href={`/result/${item.jobId}`}>
                                    Result
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {batchPhotos.length && batchPhotos.some((item) => item.jobId) ? (
                      <Link className="btn btn-secondary" href="/album">
                        Album
                      </Link>
                    ) : null}
                    {batchMessage ? (
                      <p className="field-hint">
                        {batchMessage}
                        {batchCompletedCount ? ` Complete ${batchCompletedCount}  items。` : ""}
                        {batchFailedCount ? ` Failure ${batchFailedCount}  items。` : ""}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              </>
            )}

            <div className="quick-generation-panel">
              <div className="field-row quick-generation-head">
                <div>
                  <p className="form-section-title">Basic Controls</p>
                  <p className="field-hint">Set framing, size, and placement first so the character does not appear too small.</p>
                </div>
                <span className="chip chip-sage">
                  {getOption(catalog.cameraDistances, request.cameraDistance).label} / {formatPercent(request.subjectScale)}
                </span>
              </div>

              <div className="field">
                <FieldHelpLabel
                  description="Choose how much of the character appears, such as full body, knee-up, waist-up, chest-up, or shoulder-up."
                  htmlFor="cameraDistanceRare"
                  label="Framing"
                />
                <div className="preset-button-grid framing-preset-grid">
                  {primaryCameraDistanceOptions.map((option) => (
                    <button
                      aria-pressed={request.cameraDistance === option.id}
                      className={`preset-button ${request.cameraDistance === option.id ? "is-active" : ""}`}
                      key={option.id}
                      type="button"
                      onClick={() => setRequest((current) => ({ ...current, cameraDistance: option.id }))}
                    >
                      <span className={`framing-preset-visual ${option.visualClassName}`} aria-hidden="true" />
                      <span className="preset-button-label">{option.label}</span>
                      <span className="preset-button-description">{option.description}</span>
                    </button>
                  ))}
                </div>
                <select
                  className="select select-compact"
                  id="cameraDistanceRare"
                  value={rareCameraDistanceValue}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setRequest((current) => ({
                      ...current,
                      cameraDistance: event.target.value as GenerationRequestInput["cameraDistance"],
                    }));
                  }}
                >
                  <option value="">Other Framing</option>
                  {rareCameraDistanceOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <FieldHelpLabel
                  description="Controls how strongly the character should appear large relative to the background, separate from framing."
                  htmlFor="subjectScaleFine"
                  label="Size Influence"
                />
                <div className="preset-button-grid subject-scale-grid">
                  {subjectScalePresetOptions.map((option) => (
                    <button
                      aria-pressed={request.subjectScale === option.value}
                      className={`preset-button ${request.subjectScale === option.value ? "is-active" : ""}`}
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setHasManualSubjectScale(true);
                        setRequest((current) => ({ ...current, subjectScale: option.value }));
                      }}
                    >
                      <span className={`subject-scale-visual ${option.visualClassName}`} aria-hidden="true" />
                      <span className="preset-button-label">{option.label}</span>
                      <span className="preset-button-description">{option.description}</span>
                    </button>
                  ))}
                </div>
                <p className="field-hint subject-scale-note">
                  Framing is controlled above; this controls how strongly the subject should appear larger.{activeSubjectScaleHint}{landscapeSubjectScaleHint}
                </p>
              </div>

              <div className="form-row">
                <div className="field">
                  <FieldHelpLabel
                    description="Common poses are shown as visual buttons because they strongly affect the photo. Use Other Pose for more detail."
                    htmlFor="poseRare"
                    label="Pose"
                  />
                  <div className="preset-button-grid pose-preset-grid">
                    {primaryPoseOptions.map((option) => (
                      <button
                        aria-pressed={request.pose === option.id}
                        className={`preset-button ${request.pose === option.id ? "is-active" : ""}`}
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setRequest((current) => ({
                            ...current,
                            pose: option.id,
                            poseCustomText: "",
                          }))
                        }
                      >
                        <span className={`css-preset-visual pose-visual ${option.visualClassName}`} aria-hidden="true" />
                        <span className="preset-button-label">{option.label}</span>
                        <span className="preset-button-description">{option.description}</span>
                      </button>
                    ))}
                  </div>
                  <select
                    className="select select-compact"
                    id="poseRare"
                    value={rarePoseValue}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      setRequest((current) => ({
                        ...current,
                        pose: event.target.value,
                        poseCustomText: isCustomGenerationOption(event.target.value) ? current.poseCustomText : "",
                      }));
                    }}
                  >
                    <option value="">Other Pose</option>
                    {rarePoseOptions.map((option) => (
                      <option key={option.id} disabled={option.disabled} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  {isCustomGenerationOption(request.pose) ? (
                    <input
                      aria-label="Pose custom text"
                      className="input input-compact"
                      placeholder="Example: looking back while holding hair with one hand"
                      type="text"
                      value={request.poseCustomText ?? ""}
                      onChange={(event) => setRequest((current) => ({ ...current, poseCustomText: event.target.value }))}
                    />
                  ) : null}
                </div>

                <div className="field">
                  <FieldHelpLabel
                    description="Key expressions are shown as visual buttons because the face strongly affects generation quality. Use Other Expression for detail."
                    htmlFor="expressionRare"
                    label="Expression"
                  />
                  <div className="preset-button-grid expression-preset-grid">
                    {primaryExpressionOptions.map((option) => (
                      <button
                        aria-pressed={request.expression === option.id}
                        className={`preset-button ${request.expression === option.id ? "is-active" : ""}`}
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setRequest((current) => ({
                            ...current,
                            expression: option.id,
                            expressionCustomText: "",
                          }))
                        }
                      >
                        <span className={`css-preset-visual expression-visual ${option.visualClassName}`} aria-hidden="true" />
                        <span className="preset-button-label">{option.label}</span>
                        <span className="preset-button-description">{option.description}</span>
                      </button>
                    ))}
                  </div>
                  <select
                    className="select select-compact"
                    id="expressionRare"
                    value={rareExpressionValue}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      setRequest((current) => ({
                        ...current,
                        expression: event.target.value,
                        expressionCustomText: isCustomGenerationOption(event.target.value) ? current.expressionCustomText : "",
                      }));
                    }}
                  >
                    <option value="">Other Expression</option>
                    {rareExpressionOptions.map((option) => (
                      <option key={option.id} disabled={option.disabled} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  {isCustomGenerationOption(request.expression) ? (
                    <input
                      aria-label="Expression custom text"
                      className="input input-compact"
                      placeholder="Example: slightly sleepy, triumphant, laughing through tears"
                      type="text"
                      value={request.expressionCustomText ?? ""}
                      onChange={(event) => setRequest((current) => ({ ...current, expressionCustomText: event.target.value }))}
                    />
                  ) : null}
                </div>
              </div>

              <div className="field">
                <FieldHelpLabel
                  description="Place the character in the photo's empty space, such as lower left, center, or lower right."
                  htmlFor="placementRare"
                  label="Character Position"
                />
                <div className="preset-button-grid placement-preset-grid">
                  {primaryPlacementOptions.map((option) => (
                    <button
                      aria-pressed={request.placement === option.id}
                      className={`preset-button placement-preset-button ${request.placement === option.id ? "is-active" : ""}`}
                      key={option.id}
                      type="button"
                      onClick={() => setRequest((current) => ({ ...current, placement: option.id, placementCustomText: "" }))}
                    >
                      <span className={`placement-map ${option.visualClassName}`} aria-hidden="true" />
                      <span className="preset-button-label">{option.label}</span>
                      <span className="preset-button-description">{option.description}</span>
                    </button>
                  ))}
                </div>
                <select
                  className="select select-compact"
                  id="placementRare"
                  value={rarePlacementValue}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setRequest((current) => ({
                      ...current,
                      placement: event.target.value,
                      placementCustomText: isCustomGenerationOption(event.target.value) ? current.placementCustomText : "",
                    }));
                  }}
                >
                  <option value="">Other Position</option>
                  {rarePlacementOptions.map((option) => (
                    <option key={option.id} disabled={option.disabled} value={option.id}>{option.label}</option>
                  ))}
                </select>
                {isCustomGenerationOption(request.placement) ? (
                  <input
                    aria-label="Character position custom text"
                    className="input input-compact"
                    placeholder="Example: large in the lower left, partly hidden by the desk"
                    type="text"
                    value={request.placementCustomText ?? ""}
                    onChange={(event) => setRequest((current) => ({ ...current, placementCustomText: event.target.value }))}
                  />
                ) : null}
              </div>
            </div>

            {activeTemporaryReference ? (
              <div className="field">
                <div className="chip-row">
                  <span className="chip chip-sage">Temporary Consistency Reference</span>
                  <span className="chip chip-soft">Add one previous result</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => setTemporaryReference(null)}
                  >
                    Remove
                  </button>
                </div>
                <p className="field-hint">This reference is used only for the next generation and is removed automatically after submission.</p>
              </div>
            ) : null}

            <div className="primary-action-panel">
              <button
                className="btn btn-primary btn-block btn-xl"
                disabled={isGenerating || isBatchRunning || isPreparingBackgroundPhotos || !canSubmitPrimaryGeneration}
                type="button"
                onClick={requestPrimaryGeneration}
              >
                {primaryGenerationLabel}
              </button>
              <button
                className="btn btn-ghost btn-block"
                type="button"
                disabled={
                  isGenerating ||
                  isBatchRunning ||
                  isPreparingBackgroundPhotos ||
                  hasMultipleBackgroundPhotos ||
                  !lastRequest ||
                  !canSubmitGeneration
                }
                onClick={() => {
                  if (lastRequest) requestGeneration(lastRequest);
                }}
              >
                Regenerate with Same Settings
              </button>
            </div>

            <details className="advanced-options">
              <summary className="advanced-options-summary">
                <span>Advanced Settings</span>
                <span>Posture, outfit, texture, aspect ratio, and more</span>
              </summary>

              <div className="advanced-options-body">
                <div className="form-row">
                  <SelectWithCustomInput
                    customHint="Example: kneeling on one knee, lying on the floor"
                    customPlaceholder="Enter custom body posture"
                    customValue={request.bodyPostureCustomText}
                    id="bodyPosture"
                    label="Body Posture"
                    options={catalog.bodyPostures}
                    value={request.bodyPosture}
                    onCustomValueChange={(value) => setRequest((current) => ({ ...current, bodyPostureCustomText: value }))}
                    onValueChange={(value) => setRequest((current) => ({ ...current, bodyPosture: value }))}
                  />
                  <SelectWithCustomInput
                    customHint="Example: dark navy long coat, white turtleneck, slim pants"
                    customPlaceholder="Enter custom outfit"
                    customValue={request.outfitOverrideCustomText}
                    id="outfitOverride"
                    label="Outfit"
                    options={catalog.outfits}
                    value={request.outfitOverride}
                    onCustomValueChange={(value) =>
                      setRequest((current) => ({ ...current, outfitOverrideCustomText: value }))
                    }
                    onValueChange={(value) => setRequest((current) => ({ ...current, outfitOverride: value }))}
                  />
                </div>

                <div className="form-row">
                  <SelectWithCustomInput
                    customHint="Example: heavily shaded 1980s OVA cel style"
                    customPlaceholder="Describe the character rendering texture"
                    customValue={request.characterRenderStyleCustomText}
                    id="characterRenderStyle"
                    label="Character Rendering Style"
                    options={catalog.characterRenderStyles}
                    value={request.characterRenderStyle}
                    onCustomValueChange={(value) =>
                      setRequest((current) => ({ ...current, characterRenderStyleCustomText: value }))
                    }
                    onValueChange={(value) => setRequest((current) => ({ ...current, characterRenderStyle: value }))}
                  />
                  <div className="stack-sm">
                    <SelectWithCustomInput
                      customHint="Example: hand-painted background art board style"
                      customPlaceholder="Describe the background rendering texture"
                      customValue={request.backgroundRenderStyleCustomText}
                      disabled={mode === "photo-composite" && request.preserveBackgroundPhoto}
                      id="backgroundRenderStyle"
                      label="Background Rendering Style"
                      options={catalog.backgroundRenderStyles}
                      value={request.backgroundRenderStyle}
                      onCustomValueChange={(value) =>
                        setRequest((current) => ({ ...current, backgroundRenderStyleCustomText: value }))
                      }
                      onValueChange={(value) => setRequest((current) => ({ ...current, backgroundRenderStyle: value }))}
                    />
                    {mode === "photo-composite" ? (
                      <p className="field-hint">
                        {request.preserveBackgroundPhoto
                          ? "This is not applied while Preserve Background Photo is enabled."
                          : "Use this when you also want to restyle the background photo."}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="field">
                  <FieldHelpLabel
                    description="The output aspect ratio. Choose based on use cases such as social posts or wallpapers."
                    htmlFor="aspectRatio"
                    label="Aspect Ratio"
                  />
                  <select
                    className="select"
                    id="aspectRatio"
                    value={request.aspectRatio}
                    onChange={(event) => setRequest((current) => ({ ...current, aspectRatio: event.target.value }))}
                  >
                    {catalog.aspectRatios.map((option) => (
                      <option
                        key={option.id}
                        disabled={option.id === "match-input" && !canSelectInputAspectRatio}
                        value={option.id}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {mode === "photo-composite" ? (
                    <p className="field-hint">
                      {inputAspectRatioHint
                        ? `When a background photo is selected, the aspect ratio automatically matches it. Current size: ${inputAspectRatioHint}.`
                        : "When you choose a photo, the aspect ratio automatically matches the input image."}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <FieldHelpLabel
                    description="Adds subtle foreground elements such as leaves or props in front of the character for better integration."
                    htmlFor="occlusionMode"
                    label="Foreground Occlusion"
                  />
                  <select
                    className="select"
                    id="occlusionMode"
                    value={request.occlusionMode}
                    onChange={(event) =>
                      setRequest((current) => ({
                        ...current,
                        occlusionMode: event.target.value as GenerationRequestInput["occlusionMode"],
                      }))
                    }
                  >
                    {catalog.occlusionModes.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <FieldHelpLabel
                    description="Fine-tune character size only when presets are not enough."
                    htmlFor="subjectScaleFine"
                    label="Character Size Fine-tune"
                  />
                  <div className="slider-stack">
                    <input
                      id="subjectScaleFine"
                      max={150}
                      min={60}
                      step={1}
                      type="range"
                      value={request.subjectScale}
                      onChange={(event) => {
                        setHasManualSubjectScale(true);
                        setRequest((current) => ({ ...current, subjectScale: Number(event.target.value) }));
                      }}
                    />
                    <span className="field-hint">{formatPercent(request.subjectScale)}</span>
                  </div>
                </div>

                {mode === "photo-composite" ? (
                  <>
                    <div className="field">
                      <label className="field-checkbox">
                        <input
                          checked={request.fitToPhotoContent}
                          type="checkbox"
                          onChange={(event) =>
                            setRequest((current) => ({ ...current, fitToPhotoContent: event.target.checked }))
                          }
                        />
                        <span>Composite to match the photo content</span>
                      </label>
                    </div>
                    <div className="field">
                      <label className="field-checkbox">
                        <input
                          checked={request.preserveBackgroundPhoto}
                          type="checkbox"
                          onChange={(event) =>
                            setRequest((current) => ({ ...current, preserveBackgroundPhoto: event.target.checked }))
                          }
                        />
                        <span>Do not alter the background photo</span>
                      </label>
                      <p className="field-hint">Enabled by default. While enabled, the background color and texture are not changed.</p>
                    </div>
                  </>
                ) : null}
              </div>
            </details>

            {showAnonymousPrompt ? (
              <div className="surface-card card-padded">
                <div className="stack-sm">
                  <p className="heading-md">You can generate without signing in</p>
                  <p className="surface-copy">
                    Sign in with Google to keep the result in your account. Anonymous users can use one studio generation per day while the daily trial quota is available.
                  </p>
                  <div className="sign-in-actions">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => void signIn("google", { callbackUrl: "/api/anonymous/claim?next=/studio" })}
                    >
                      Sign in with Google
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={isGenerating || isPreparingImage || !isAnonymous}
                      type="button"
                      onClick={() => requestGeneration(undefined, { allowAnonymous: true })}
                    >
                      Generate Anonymously
                    </button>
                  </div>
                  {!isAnonymous ? (
                    <p className="field-hint">Create one anonymous character in the form before using anonymous studio generation.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!isSignedIn ? (
              <div className="chip-row">
                <span className="chip chip-soft">Anonymous: one studio generation</span>
                <span className="chip chip-sage">Daily trial quota: 10 users</span>
              </div>
            ) : null}

            {error ? <p className="error-text">{error}</p> : null}
          </div>
        </div>

        <div className="stack-lg">
          <div className="side-panel">
            <div className="side-panel-head">
              <div>
                <h3 className="heading-md">Reference</h3>
                <p className="text-sm text-secondary">
                  {activeReferencePack ? `v${activeReferencePack.version} previewing` : "No references yet"}
                </p>
              </div>
              {isSignedIn && selectedCharacter && selectedCharacter.source !== "existing-assets" ? (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={isRegeneratingPack}
                  type="button"
                  onClick={() => void regenerateReferencePack()}
                >
                  {isRegeneratingPack ? "Creating..." : "Regenerate"}
                </button>
              ) : null}
            </div>
            {selectedCharacter && activeReferencePack ? (
              <div className="stack-md">
                <div className="chip-row">
                  <span className="chip chip-soft">{selectedCharacter.name}</span>
                  <span className={`chip ${selectedCharacter.source === "existing-assets" ? "chip-sage" : "chip-soft"}`}>
                    {selectedCharacter.source === "existing-assets" ? "Existing Images" : "AI Generated"}
                  </span>
                  <span className="chip chip-sage">{characterReferencePacks.length} candidates</span>
                  <span className="chip chip-soft">
                    Consistency References {selectedCharacter.consistencyAssetIds.length}  items
                  </span>
                </div>
                {selectedCharacter.source === "existing-assets" ? (
                  <p className="text-xs text-tertiary">
                    This character uses uploaded images as its default references.
                  </p>
                ) : null}
                <div className="consistency-reference-panel">
                  <div className="meta-row">
                    <span>Adopted Consistency References</span>
                    <strong>{selectedCharacter.consistencyAssetIds.length}  items</strong>
                  </div>
                  <div className="meta-row">
                    <span>Temporary Reference</span>
                    <strong>{activeTemporaryReference ? "On" : "None"}</strong>
                  </div>
                  <div className="btn-row">
                    {isSignedIn && selectedCharacter.consistencyAssetIds.length > 0 ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => void clearConsistencyReferences()}
                      >
                        Clear Adopted References
                      </button>
                    ) : null}
                    {activeTemporaryReference ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => setTemporaryReference(null)}
                      >
                        Remove Temporary Reference
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-tertiary">
                    Adopted references are used until cleared. Temporary references are removed automatically after the next generation.
                  </p>
                </div>
                {characterReferencePacks.length > 1 ? (
                  <div className="chip-row">
                    {characterReferencePacks.map((pack) => (
                      <button
                        key={pack.id}
                        className={`chip chip-selectable ${pack.id === activeReferencePack.id ? "chip-selected" : ""}`}
                        type="button"
                        onClick={() =>
                          setReferencePackSelection((current) => ({
                            ...current,
                            [selectedCharacter.id]: pack.id,
                          }))
                        }
                      >
                        {`v${pack.version}${pack.id === selectedCharacter.referencePackId ? " Default" : ""}`}
                      </button>
                    ))}
                  </div>
                ) : null}
                {activeReferencePack.id !== selectedCharacter.referencePackId ? (
                  <div className="btn-row">
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => void adoptReferencePack(activeReferencePack.id)}
                    >
                      Set This Sheet as Default
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-tertiary">This sheet is the current default.</p>
                )}
                <div className="ref-grid">
                  {activeReferencePack.images.map((image) => (
                    <div className="ref-card" key={image.id}>
                      <Image alt={image.label} src={image.imageUrl} width={960} height={960} unoptimized />
                      <p className="ref-card-label">{image.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="stack-sm">
                <p className="text-sm text-secondary">No references yet</p>
                <Link className="btn btn-secondary btn-sm" href="/builder">Create in Builder</Link>
              </div>
            )}
          </div>

          <div className="side-panel">
            <h3 className="heading-md">Composite Preview Settings</h3>
            <div className="chip-row">
              <span className="chip chip-soft">{mode === "scene-template" ? "Scene Template" : "Photo Composite"}</span>
              <span className="chip chip-soft">{resolveGenerationFieldOption(request, "characterRenderStyle").label}</span>
            </div>
            <div className="chip-row">
              {selectedCharacters.map((character, index) => (
                <span className={`chip ${index === 0 ? "chip-sage" : "chip-soft"}`} key={character.id}>
                  {index === 0 ? `Lead: ${character.name}` : character.name}
                </span>
              ))}
            </div>
            <div className="meta-list">
              <div className="meta-row"><span>Characters</span><strong>{selectedCharacters.length} characters</strong></div>
              {mode === "scene-template" ? (
                <div className="meta-row"><span>Scene Template</span><strong>{sceneTemplateLabel(sceneTemplates, request)}</strong></div>
              ) : null}
              <div className="meta-row"><span>Aspect Ratio</span><strong>{getOption(catalog.aspectRatios, request.aspectRatio).label}</strong></div>
              <div className="meta-row"><span>Foreground</span><strong>{getOption(catalog.occlusionModes, request.occlusionMode).label}</strong></div>
              <div className="meta-row"><span>Body Posture</span><strong>{resolveGenerationFieldOption(request, "bodyPosture").label}</strong></div>
              <div className="meta-row"><span>Pose</span><strong>{resolveGenerationFieldOption(request, "pose").label}</strong></div>
              <div className="meta-row"><span>Expression</span><strong>{resolveGenerationFieldOption(request, "expression").label}</strong></div>
              <div className="meta-row"><span>Placement</span><strong>{resolveGenerationFieldOption(request, "placement").label}</strong></div>
              <div className="meta-row"><span>Outfit</span><strong>{resolveGenerationFieldOption(request, "outfitOverride").label}</strong></div>
              <div className="meta-row"><span>Character Style</span><strong>{resolveGenerationFieldOption(request, "characterRenderStyle").label}</strong></div>
              <div className="meta-row"><span>Background Style</span><strong>{request.preserveBackgroundPhoto && mode === "photo-composite" ? "Preserve Original Photo" : resolveGenerationFieldOption(request, "backgroundRenderStyle").label}</strong></div>
              <div className="meta-row"><span>Fit Photo</span><strong>{request.fitToPhotoContent ? "On" : "Off"}</strong></div>
              {mode === "photo-composite" ? (
                <div className="meta-row"><span>Preserve Background</span><strong>{request.preserveBackgroundPhoto ? "On" : "Off"}</strong></div>
              ) : null}
            </div>
          </div>

          {activeTemporaryReference?.asset ? (
            <div className="side-panel">
              <div className="side-panel-head">
                <h3 className="heading-md">Temporary Reference</h3>
                <span className="chip chip-sage">Next generation only</span>
              </div>
              <div className="stack-sm">
                <div className="ref-card">
                  <Image
                    alt={activeTemporaryReference.asset.name}
                    src={activeTemporaryReference.asset.imageUrl}
                    width={activeTemporaryReference.asset.width}
                    height={activeTemporaryReference.asset.height}
                    unoptimized
                  />
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => setTemporaryReference(null)}
                >
                  Remove Temporary Reference
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
