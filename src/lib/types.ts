export type GenerationMode = "scene-template" | "photo-composite";
export type CharacterSource = "builder" | "existing-assets";
export type ReferencePackOrigin = "generated" | "uploaded";
export type JobStatus =
  | "queued"
  | "analyzing-background"
  | "preparing-references"
  | "rendering"
  | "completed"
  | "failed";
export type RenderProvider = "user-codex";
export type ApiUsageOperationType = "generation" | "reference-pack";
export type ApiUsageStatus = "success" | "error";
export type ReferenceImageKind =
  | "reference-sheet"
  | "full-body"
  | "portrait"
  | "three-quarter"
  | "expression-sheet";
export type AssetOrientation = "landscape" | "portrait" | "square";
export type SubjectAnchor = "unspecified" | "left" | "center" | "right";
export type DepthLayer = "unspecified" | "foreground" | "midground" | "background";
export type LightingMode = "unspecified" | "match-background" | "soft-studio" | "golden-hour" | "neon-dramatic";
export type OcclusionMode = "unspecified" | "none" | "soft-foreground" | "frame-with-props";
export type ConsistencyMode = "unspecified" | "strict" | "balanced" | "free";
export type SceneEnvironment = "indoor" | "outdoor" | "mixed";
export type SceneBrightness = "bright" | "balanced" | "moody";
export type CharacterColorMode = "preset" | "custom";
export type CharacterCustomField =
  | "genderPresentation"
  | "facePreset"
  | "bodyPreset"
  | "hairStyle"
  | "hairColor"
  | "bangs"
  | "eyes"
  | "eyebrows"
  | "mouth"
  | "faceShape"
  | "skinTone"
  | "heightProfile"
  | "bodyType"
  | "outfit"
  | "outfitMaterial"
  | "outfitPattern"
  | "outerwear"
  | "innerwear"
  | "bottoms"
  | "shoes"
  | "socks"
  | "gloves"
  | "hat"
  | "onePoint";

export interface CharacterColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  detail: string;
  highlight: string;
}

export type CharacterCustomFieldMap = Partial<Record<CharacterCustomField, string>>;

export interface BackgroundCrop {
  zoom: number;
  focusX: number;
  focusY: number;
}

export interface SceneAnalysis {
  environment: SceneEnvironment;
  brightness: SceneBrightness;
  orientation: AssetOrientation;
  suggestedPlacement: SubjectAnchor;
  summary: string;
}

export interface PromptBreakdown {
  characterCore: string;
  characterFlex: string;
  scene: string;
  direction: string;
  qualityGuard: string;
  negative: string;
}

export interface CharacterParts {
  outfitSelectionMode: string;
  outfitSelectionModeLabel: string;
  sex: string;
  sexLabel: string;
  ageGroup: string;
  ageGroupLabel: string;
  genderPresentation: string;
  genderPresentationLabel: string;
  facePreset: string;
  facePresetLabel: string;
  bodyPreset: string;
  bodyPresetLabel: string;
  hairStyle: string;
  hairStyleLabel: string;
  hairColor: string;
  hairColorLabel: string;
  bangs: string;
  bangsLabel: string;
  eyes: string;
  eyesLabel: string;
  eyebrows: string;
  eyebrowsLabel: string;
  mouth: string;
  mouthLabel: string;
  faceShape: string;
  faceShapeLabel: string;
  skinTone: string;
  skinToneLabel: string;
  heightProfile: string;
  heightProfileLabel: string;
  bodyType: string;
  bodyTypeLabel: string;
  outfit: string;
  outfitLabel: string;
  outfitMaterial: string;
  outfitMaterialLabel: string;
  outfitPattern: string;
  outfitPatternLabel: string;
  colorway: string;
  colorwayLabel: string;
  colorMode: CharacterColorMode;
  colorPalette: CharacterColorPalette;
  outerwear: string;
  outerwearLabel: string;
  innerwear: string;
  innerwearLabel: string;
  bottoms: string;
  bottomsLabel: string;
  shoes: string;
  shoesLabel: string;
  socks: string;
  socksLabel: string;
  gloves: string;
  glovesLabel: string;
  hat: string;
  hatLabel: string;
  onePoint: string;
  onePointLabel: string;
  customFields: CharacterCustomFieldMap;
  customMarkText: string;
  outfitDetailNotes: string;
  accessories: string[];
  accessoriesLabel: string[];
  customAccessoryNotes: string;
}

export interface CharacterSpec {
  id: string;
  name: string;
  tagline: string;
  story: string;
  negativePrompt: string;
  style: "anime";
  source: CharacterSource;
  parts: CharacterParts;
  normalizedPrompt: string;
  createdAt: string;
  referencePackId?: string;
  consistencyAssetIds: string[];
  isDefaultTemplate: boolean;
  templateKey?: string;
}

export interface ReferenceImage {
  id: string;
  kind: ReferenceImageKind;
  label: string;
  prompt: string;
  imageUrl: string;
  assetId: string;
}

export interface ReferencePack {
  id: string;
  characterId: string;
  provider: RenderProvider;
  origin: ReferencePackOrigin;
  version: number;
  prompt: string;
  fixedPrompt: string;
  variationPrompt: string;
  negativePrompt: string;
  seed: number;
  createdAt: string;
  images: ReferenceImage[];
}

export interface SceneTemplate {
  id: string;
  category: string;
  label: string;
  description: string;
  promptHint: string;
}

export interface Asset {
  id: string;
  kind: "reference" | "generated" | "upload";
  name: string;
  imageUrl: string;
  mimeType: string;
  width: number;
  height: number;
  orientation: AssetOrientation;
  fileSize: number;
  createdAt: string;
  sceneAnalysis?: SceneAnalysis;
  storagePath?: string;
  sourceJobId?: string;
  sourceAssetId?: string;
  trashedAt?: string;
}

export interface GenerationJob {
  id: string;
  characterId: string;
  characterIds?: string[];
  referencePackId: string;
  referencePackIds?: string[];
  provider: RenderProvider;
  mode: GenerationMode;
  sceneTemplateId?: string;
  sceneTemplateCustomText?: string;
  assetId?: string;
  pose: string;
  poseCustomText?: string;
  bodyPosture: string;
  bodyPostureCustomText?: string;
  expression: string;
  expressionCustomText?: string;
  cameraDistance: string;
  aspectRatio: string;
  placement: string;
  placementCustomText?: string;
  outfitOverride: string;
  outfitOverrideCustomText?: string;
  consistencyMode: ConsistencyMode;
  backgroundCrop: BackgroundCrop;
  subjectAnchor: SubjectAnchor;
  subjectScale: number;
  depthLayer: DepthLayer;
  lightingMode: LightingMode;
  occlusionMode: OcclusionMode;
  styleStrength: number;
  fitToPhotoContent: boolean;
  preserveBackgroundPhoto: boolean;
  characterRenderStyle: string;
  characterRenderStyleCustomText?: string;
  backgroundRenderStyle: string;
  backgroundRenderStyleCustomText?: string;
  variationOfJobId?: string;
  batchGroupId?: string;
  prompt: string;
  promptBreakdown: PromptBreakdown;
  negativePrompt: string;
  backgroundAnalysis?: SceneAnalysis;
  referenceAssetIds: string[];
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  resultAssetId?: string;
  albumItemId?: string;
  failureReason?: string;
  codexWorkerId?: string;
  codexWorkerClaimedAt?: string;
  codexWorkerLeaseUntil?: string;
  trashedAt?: string;
}

export interface AlbumItem {
  id: string;
  characterId: string;
  generationJobId: string;
  assetId: string;
  title: string;
  promptExcerpt: string;
  sourceMode: GenerationMode;
  favorite: boolean;
  createdAt: string;
  trashedAt?: string;
}

export interface AlbumDeletionResult {
  deletedAlbumItemIds: string[];
  deletedJobIds: string[];
  removedAssetIds: string[];
}

export interface AlbumTrashResult {
  trashedAt: string;
  trashedAlbumItemIds: string[];
  trashedJobIds: string[];
  trashedAssetIds: string[];
}

export interface CharacterCatalogOption {
  id: string;
  label: string;
  prompt: string;
  description?: string;
  badge?: string;
  swatches?: string[];
  disabled?: boolean;
}

export interface CharacterDraftInput {
  name: string;
  tagline: string;
  story: string;
  negativePrompt: string;
  outfitSelectionMode: string;
  sex: string;
  ageGroup: string;
  genderPresentation: string;
  facePreset: string;
  bodyPreset: string;
  customFields: CharacterCustomFieldMap;
  hairStyle: string;
  hairColor: string;
  bangs: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
  faceShape: string;
  skinTone: string;
  heightProfile: string;
  bodyType: string;
  outfit: string;
  outfitMaterial: string;
  outfitPattern: string;
  colorway: string;
  colorMode: CharacterColorMode;
  customColorPalette: CharacterColorPalette;
  outerwear: string;
  innerwear: string;
  bottoms: string;
  shoes: string;
  socks: string;
  gloves: string;
  hat: string;
  onePoint: string;
  customMarkText: string;
  outfitDetailNotes: string;
  accessories: string[];
  customAccessoryNotes: string;
}

export interface GenerationRequestInput {
  characterId: string;
  characterIds?: string[];
  referencePackId?: string;
  referencePackIds?: string[];
  temporaryReferenceAssetIds?: string[];
  mode: GenerationMode;
  sceneTemplateId?: string;
  sceneTemplateCustomText?: string;
  assetId?: string;
  pose: string;
  poseCustomText?: string;
  bodyPosture: string;
  bodyPostureCustomText?: string;
  expression: string;
  expressionCustomText?: string;
  cameraDistance: string;
  aspectRatio: string;
  placement: string;
  placementCustomText?: string;
  outfitOverride: string;
  outfitOverrideCustomText?: string;
  consistencyMode: ConsistencyMode;
  backgroundCrop: BackgroundCrop;
  subjectAnchor: SubjectAnchor;
  subjectScale: number;
  depthLayer: DepthLayer;
  lightingMode: LightingMode;
  occlusionMode: OcclusionMode;
  styleStrength: number;
  fitToPhotoContent: boolean;
  preserveBackgroundPhoto: boolean;
  characterRenderStyle: string;
  characterRenderStyleCustomText?: string;
  backgroundRenderStyle: string;
  backgroundRenderStyleCustomText?: string;
  variationOfJobId?: string;
  batchGroupId?: string;
}

export interface ProviderInfo {
  requested: string;
  resolved: RenderProvider;
  ready: boolean;
  message: string;
}

export interface ApiUsageLogEntry {
  id: string;
  createdAt: string;
  userId: string;
  userLabel: string;
  generationJobId?: string;
  characterId?: string;
  provider: string;
  model?: string;
  operationType: ApiUsageOperationType;
  requestKind: string;
  status: ApiUsageStatus;
  failureReason?: string;
  promptChars: number;
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
  sourceImageCount: number;
  sourceImageBytes: number;
  responseImageCount: number;
  latencyMs: number;
  estimatedCostMicros?: number;
}

export interface ApiUsageDailySummary {
  date: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
}

export interface ApiUsageUserSummary {
  userId: string;
  userLabel: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  totalTokens: number;
  estimatedCostMicros: number;
}

export interface AdminUserActivitySummary {
  userId: string;
  userLabel: string;
  accountKind: "signed-in" | "anonymous";
  lastLoginAt?: string;
  lastActiveAt?: string;
  activeSessionExpiresAt?: string;
  generationJobs: number;
  apiCalls: number;
  characters: number;
  assets: number;
  albumItems: number;
}

export interface AdminUserActivitySnapshot {
  totalUsers: number;
  signedInUsers: number;
  anonymousUsers: number;
  activeUsersLast7Days: number;
  activeSessions: number;
  latestLoginAt?: string;
}

export interface AdminUserActivityDashboard {
  snapshot: AdminUserActivitySnapshot;
  users: AdminUserActivitySummary[];
}

export interface CodexGenerationUsageSummary {
  connected: boolean;
  todayImages: number;
  totalImages: number;
}

export interface CodexWorkerSummary {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  expired: boolean;
  connected: boolean;
}

export interface CodexWorkerTokenCreateResult {
  worker: CodexWorkerSummary;
  token: string;
}

export interface CodexWorkerRenderSource {
  label: string;
  mimeType: string;
  dataUrl: string;
}

export interface CodexWorkerClaimedJob {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  width: number;
  height: number;
  posePriority: boolean;
  sourceImages: CodexWorkerRenderSource[];
}

export interface ApiUsageDashboardSnapshot {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
}

export interface ApiUsageDashboardPayload {
  last24Hours: ApiUsageDashboardSnapshot;
  last30Days: ApiUsageDashboardSnapshot;
  recentLogs: ApiUsageLogEntry[];
  dailySummaries: ApiUsageDailySummary[];
  topUsers: ApiUsageUserSummary[];
  userActivity: AdminUserActivityDashboard;
  codexGeneration?: CodexGenerationUsageSummary;
}

export interface GenerationJobPayload {
  job: GenerationJob;
  asset?: Asset;
  albumItem?: AlbumItem;
  character?: CharacterSpec;
  characters?: CharacterSpec[];
  referencePack?: ReferencePack;
  backgroundAsset?: Asset;
  referenceAssets?: Asset[];
  variationChildren?: GenerationJob[];
  variationSource?: GenerationJob;
  usedSceneTemplate?: SceneTemplate;
}

export interface UploadAnalysisInput {
  environment?: SceneEnvironment;
  brightness?: SceneBrightness;
  suggestedPlacement?: SubjectAnchor;
  summary?: string;
}

export interface UploadAssetInput {
  analysis?: UploadAnalysisInput;
}

export interface ExistingCharacterRegistrationInput {
  draft: CharacterDraftInput;
  referenceAssetIds: string[];
}

export interface ValidationProblem {
  field?: string;
  message: string;
}
