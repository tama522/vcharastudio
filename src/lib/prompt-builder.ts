import {
  CUSTOM_SCENE_TEMPLATE_ID,
  catalog,
  getOption,
  isMeaningfulOptionLabel,
  resolveGenerationFieldOption,
  resolveDraftAccessoryPrompt,
  resolveDraftColorPrompt,
  resolveDraftFieldOption,
} from "@/lib/catalog";
import type {
  CharacterDraftInput,
  CharacterSpec,
  GenerationJob,
  GenerationRequestInput,
  PromptBreakdown,
  ReferenceImageKind,
  SceneAnalysis,
  SceneTemplate,
} from "@/lib/types";

function accessoryPrompt(accessories: string[]) {
  return accessories
    .map((id) => getOption(catalog.accessories, id).prompt)
    .filter(Boolean)
    .join(", ");
}

function onePointPrompt(draft: CharacterDraftInput) {
  const base = resolveDraftFieldOption(draft, "onePoint").prompt;
  const customText = draft.customMarkText.trim();

  if (!base) {
    return customText ? `small typographic clothing accent reading "${customText}"` : "";
  }

  if (!customText) {
    return base;
  }

  return `${base}, with the text "${customText}" integrated as a clothing accent`;
}

function separateOutfitPrompt(draft: CharacterDraftInput) {
  const parts = [
    "custom coordinated outfit assembled from separate clothing items",
    resolveDraftFieldOption(draft, "outerwear").prompt,
    resolveDraftFieldOption(draft, "innerwear").prompt,
    resolveDraftFieldOption(draft, "bottoms").prompt,
    resolveDraftFieldOption(draft, "shoes").prompt,
    resolveDraftFieldOption(draft, "socks").prompt,
    resolveDraftFieldOption(draft, "gloves").prompt,
    resolveDraftFieldOption(draft, "hat").prompt,
  ];

  return parts.filter(Boolean).join(", ");
}

function buildCharacterCoreSegments(draft: CharacterDraftInput) {
  return [
    "anime character reference sheet, cohesive design, polished linework, stable silhouette",
    getOption(catalog.sexes, draft.sex).prompt,
    getOption(catalog.ageGroups, draft.ageGroup).prompt,
    resolveDraftFieldOption(draft, "genderPresentation").prompt,
    resolveDraftFieldOption(draft, "facePreset").prompt,
    resolveDraftFieldOption(draft, "bodyPreset").prompt,
    resolveDraftFieldOption(draft, "hairStyle").prompt,
    resolveDraftFieldOption(draft, "hairColor").prompt,
    resolveDraftFieldOption(draft, "bangs").prompt,
    resolveDraftFieldOption(draft, "eyes").prompt,
    resolveDraftFieldOption(draft, "eyebrows").prompt,
    resolveDraftFieldOption(draft, "mouth").prompt,
    resolveDraftFieldOption(draft, "faceShape").prompt,
    resolveDraftFieldOption(draft, "skinTone").prompt,
    resolveDraftFieldOption(draft, "heightProfile").prompt,
    resolveDraftFieldOption(draft, "bodyType").prompt,
  ].filter(Boolean);
}

function buildCharacterFlexSegments(draft: CharacterDraftInput) {
  return [
    draft.outfitSelectionMode === "separate"
      ? separateOutfitPrompt(draft)
      : resolveDraftFieldOption(draft, "outfit").prompt,
    resolveDraftFieldOption(draft, "outfitMaterial").prompt,
    resolveDraftFieldOption(draft, "outfitPattern").prompt,
    resolveDraftColorPrompt(draft),
    onePointPrompt(draft),
    resolveDraftAccessoryPrompt(draft) || accessoryPrompt(draft.accessories),
    draft.outfitDetailNotes,
    draft.story,
  ].filter(Boolean);
}

export function buildNegativePromptText(negativePrompt: string) {
  const normalized = negativePrompt.trim();
  return normalized ? `avoid: ${normalized}` : "";
}

export function buildNormalizedCharacterPrompt(draft: CharacterDraftInput) {
  return [...buildCharacterCoreSegments(draft), ...buildCharacterFlexSegments(draft)].join(", ");
}

function referenceFraming(kind: ReferenceImageKind) {
  switch (kind) {
    case "reference-sheet":
      return "single premium character reference sheet, minimalist editorial layout, simple and very stylish design board, title only, no captions, no labels, no extra text, one full-body front view, one full-body side view, one full-body back view, six facial expressions showing neutral, very happy, heart-eyes in love, surprised, teary, and frustrated emotions, clean spacing, white or soft neutral backdrop, no props, no clutter";
    case "full-body":
      return "full body front-facing standing pose, clear outfit visibility, clean turnaround energy";
    case "portrait":
      return "close portrait, focus on face and hair details, confident design sheet framing";
    case "three-quarter":
      return "three-quarter angle character sheet, confident pose, face and silhouette both readable";
    case "expression-sheet":
      return "expression sheet with four moods, face clarity, hairstyle consistency, compact composition";
    default:
      return "character reference framing";
  }
}

export function buildReferencePrompt(character: CharacterSpec, kind: ReferenceImageKind) {
  const prompt = [
    character.normalizedPrompt,
    referenceFraming(kind),
    "anime style reference artwork, plain refined backdrop, strong character consistency, same costume across all panels, highly readable silhouette, polished fashion illustration finish",
    buildNegativePromptText(character.negativePrompt),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    prompt,
    fixedPrompt: buildCharacterIdentityPrompt(character),
    variationPrompt: buildCharacterVariationPrompt(character),
    negativePrompt: buildNegativePromptText(character.negativePrompt),
  };
}

function describeBackgroundAnalysis(sceneAnalysis?: SceneAnalysis) {
  if (!sceneAnalysis) return "";

  return [
    sceneAnalysis.summary,
    sceneAnalysis.environment === "indoor"
      ? "indoor scene cues"
      : sceneAnalysis.environment === "outdoor"
        ? "outdoor scene cues"
        : "mixed indoor and outdoor cues",
    sceneAnalysis.brightness === "bright"
      ? "bright ambient lighting"
      : sceneAnalysis.brightness === "moody"
        ? "moody low-key lighting"
        : "balanced ambient lighting",
  ]
    .filter(Boolean)
    .join(", ");
}

function describePhotoBackgroundHandling(backgroundRenderPrompt: string, preserveBackgroundPhoto: boolean) {
  if (preserveBackgroundPhoto) {
    return [
      "keep the uploaded background photo completely unchanged",
      "do not restyle, repaint, redraw, replace, or alter any background surfaces, props, foliage, sky, textures, colors, or lighting",
      "preserve the original scene exactly as provided while compositing only the character into it",
    ].join(", ");
  }

  if (!backgroundRenderPrompt) {
    return "";
  }

  return [
    `restyle the uploaded background photo itself as ${backgroundRenderPrompt}`,
    "apply that visual treatment across the full background, including surfaces, props, foliage, sky, and textures",
    "keep the original scene layout, perspective, depth relationships, and major background objects recognizable",
    "do not leave the background as mostly untouched live-action photography",
  ].join(", ");
}

export function buildCharacterIdentityPrompt(character: CharacterSpec) {
  return [
    "keep the same face, hair silhouette, body proportions, signature colors, and overall vibe",
    character.normalizedPrompt,
  ].join(", ");
}

export function buildCharacterVariationPrompt(character: CharacterSpec) {
  return [
    isMeaningfulOptionLabel(character.parts.outfitLabel) ? character.parts.outfitLabel : "",
    character.story,
    "allow pose, framing, and styling variation within the established design",
  ]
    .filter(Boolean)
    .join(", ");
}

function buildCompositeCharacterIdentityPrompt(characters: CharacterSpec[]) {
  if (characters.length === 1) {
    return buildCharacterIdentityPrompt(characters[0]);
  }

  return [
    "preserve each selected character's unique face, hairstyle, body proportions, signature colors, and overall vibe",
    ...characters.map((character, index) =>
      `${index === 0 ? "lead character" : `supporting character ${index}`}: ${character.normalizedPrompt}`,
    ),
  ]
    .filter(Boolean)
    .join(", ");
}

function buildCompositeCharacterVariationPrompt(characters: CharacterSpec[]) {
  if (characters.length === 1) {
    return buildCharacterVariationPrompt(characters[0]);
  }

  return characters
    .map((character, index) =>
      [
        index === 0 ? "lead character styling" : `supporting character ${index} styling`,
        isMeaningfulOptionLabel(character.parts.outfitLabel) ? character.parts.outfitLabel : "",
        character.story,
      ]
        .filter(Boolean)
        .join(": "),
    )
    .filter(Boolean)
    .join(", ");
}

function buildCompositeNegativePrompt(characters: CharacterSpec[]) {
  const merged = characters
    .map((character) => character.negativePrompt.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(", ");

  return buildNegativePromptText(merged);
}

function buildOutfitDirectionPrompt(request: GenerationRequestInput, characterCount: number) {
  const outfitPrompt = resolveGenerationFieldOption(request, "outfitOverride").prompt;
  if (!outfitPrompt) return "";
  return characterCount > 1
    ? `apply this outfit direction primarily to the lead character: ${outfitPrompt}`
    : outfitPrompt;
}

function buildCameraDistancePrompt(cameraDistance: GenerationRequestInput["cameraDistance"]) {
  switch (cameraDistance) {
    case "auto-photo":
      return [
        "camera distance priority: choose the framing from the uploaded photo or selected background context",
        "default toward a larger readable character with waist-up, chest-up, or shoulder-up framing when it fits naturally",
        "use full-body or wide full-body framing only when the floor, furniture, doorway, group spacing, or scene context clearly requires it",
        "do not default to a tiny full-body character or excessive empty background",
      ].join(", ");
    case "full":
      return [
        "camera distance priority: full body framing",
        "the entire character must be fully visible from head to toe within the frame",
        "do not crop the feet, legs, hands, or top of the head",
      ].join(", ");
    case "medium":
      return [
        "camera distance priority: above-knee medium shot framing",
        "frame the character from just above the knees upward",
        "avoid both full-body framing and extreme close-ups",
      ].join(", ");
    case "close":
      return [
        "camera distance priority: bust-up close-up framing",
        "show the head, shoulders, chest, and upper torso prominently",
        "do not show the full body or a wide shot",
      ].join(", ");
    case "wide-full":
      return [
        "camera distance priority: wide full body framing",
        "keep the entire character visible from head to toe with clear breathing room around the figure",
        "show noticeably more surrounding background than a standard full-body shot",
      ].join(", ");
    case "waist-up":
      return [
        "camera distance priority: waist-up framing",
        "frame the character from around the waist upward",
        "avoid full-body framing and avoid cropping tighter than the chest",
      ].join(", ");
    case "chest-up":
      return [
        "camera distance priority: chest-up framing",
        "frame the character from around the chest upward with the face clearly readable",
        "do not show the full body or shrink the character to show extra background",
      ].join(", ");
    case "shoulders-up":
      return [
        "camera distance priority: shoulder-up portrait framing",
        "frame the character from the shoulders upward with the face as the main subject",
        "avoid showing the lower torso, legs, or a wide composition",
      ].join(", ");
    case "portrait-close":
      return [
        "camera distance priority: portrait close-up framing",
        "focus tightly on the face with shoulders or a small part of the upper chest",
        "do not show the lower body or a wide composition",
      ].join(", ");
    default:
      return "";
  }
}

function buildSubjectScalePrompt(
  subjectScale: number,
  characterCount: number,
  options: { autoPhotoFraming?: boolean; backgroundOrientation?: SceneAnalysis["orientation"] } = {},
) {
  const roundedScale = Math.round(subjectScale);
  const landscapeScaleDirection =
    options.backgroundOrientation === "landscape"
      ? [
          "wide landscape photo scale compensation: do not let the character become small just because the canvas is wide",
          "use a stronger foreground or waist-up/chest-up composition when the landscape photo has empty side space",
          "keep the face readable and avoid tiny full-body placement in the wide frame",
        ].join(", ")
      : "";

  if (options.autoPhotoFraming) {
    const scaleBias =
      roundedScale >= 138
        ? "the user's scale bias strongly favors a very large close character with the face as the priority"
        : roundedScale >= 124
          ? "the user's scale bias favors a hero-large character with strong presence"
          : roundedScale >= 108
            ? "the user's scale bias favors a larger readable character"
            : roundedScale < 100
              ? "the user's scale bias is natural or slightly smaller, but keep the face readable and avoid tiny placement"
              : "choose the most natural photo-aware size while keeping the character clearly readable";

    return [
      "photo-aware subject scale priority",
      `user selected subject scale bias: ${roundedScale}%`,
      characterCount > 1
        ? "choose the group size from the background context while keeping every selected character visible and each face readable"
        : "choose the character size from the background context while keeping the face and expression clearly readable",
      "prefer a larger character when the photo can support it naturally",
      "use full-body scale only when the photo context clearly needs a full figure",
      "avoid making the character small just to show the entire body",
      landscapeScaleDirection,
      scaleBias,
    ].filter(Boolean).join(", ");
  }

  const scaleDirection =
    roundedScale < 85
      ? "make the character placement noticeably smaller with more surrounding background"
      : roundedScale > 115
        ? "make the character placement noticeably larger and more dominant in the frame"
        : "use a natural medium character size";

  return [
    `strict subject scale priority: ${roundedScale}%`,
    characterCount > 1
      ? `size the entire selected character group at ${roundedScale}% relative to the uploaded background`
      : `size the character at ${roundedScale}% relative to the uploaded background`,
    scaleDirection,
    landscapeScaleDirection,
    "do not ignore the subject scale when composing the character into the photo",
  ].filter(Boolean).join(", ");
}

interface GenerationPromptOptions {
  sceneTemplate?: SceneTemplate;
  backgroundAnalysis?: SceneAnalysis;
  variationSource?: GenerationJob;
  codexPosePriority?: boolean;
}

function buildPhotoFitPrompt(request: GenerationRequestInput, options?: GenerationPromptOptions) {
  if (!request.fitToPhotoContent) return "";

  if (options?.codexPosePriority) {
    return [
      "fit the composite to the uploaded photo through lighting, perspective, scale, occlusion, shadows, and contact points only",
      "do not choose or preserve the character pose, body direction, limb placement, head tilt, camera distance, or framing from reference images when explicit pose, body-posture, camera, or placement controls are selected",
    ].join(", ");
  }

  return "adjust the character staging, emotion, and compositing to match the uploaded photo content naturally";
}

function buildCodexPoseIdentityPrompt(enabled?: boolean) {
  if (!enabled) return "";

  return [
    "Codex identity and pose separation priority",
    "reproduce the photographed or reference character identity strongly: face, hairstyle, outfit cues, signature colors, body proportions, and overall character likeness",
    "redraw the body orientation, torso angle, limb placement, head tilt, camera distance, framing, and placement to match the selected pose and body-posture instructions",
    "do not reuse a reference image pose or body angle unless the text explicitly asks for that exact pose",
  ].join(", ");
}

function buildGenerationBreakdown(
  characterInput: CharacterSpec | CharacterSpec[],
  request: GenerationRequestInput,
  options?: GenerationPromptOptions,
): PromptBreakdown {
  const characters = Array.isArray(characterInput) ? characterInput : [characterInput];
  const sceneTemplatePrompt =
    request.sceneTemplateId === CUSTOM_SCENE_TEMPLATE_ID
      ? request.sceneTemplateCustomText?.trim() ?? ""
      : options?.sceneTemplate?.promptHint ?? "stylized scenic background";
  const scenePrompt =
    request.mode === "scene-template"
      ? [
          sceneTemplatePrompt,
          resolveGenerationFieldOption(request, "backgroundRenderStyle").prompt,
        ]
          .filter(Boolean)
          .join(", ")
      : [
          "real photo composite, preserve perspective and native lighting",
          buildPhotoFitPrompt(request, options),
          describeBackgroundAnalysis(options?.backgroundAnalysis),
          getOption(catalog.subjectAnchors, request.subjectAnchor).prompt,
          getOption(catalog.depthLayers, request.depthLayer).prompt,
          getOption(catalog.lightingModes, request.lightingMode).prompt,
          getOption(catalog.occlusionModes, request.occlusionMode).prompt,
          describePhotoBackgroundHandling(
            resolveGenerationFieldOption(request, "backgroundRenderStyle").prompt,
            request.preserveBackgroundPhoto,
          ),
          buildSubjectScalePrompt(request.subjectScale, characters.length, {
            autoPhotoFraming: request.cameraDistance === "auto-photo",
            backgroundOrientation: options?.backgroundAnalysis?.orientation,
          }),
          `background crop zoom ${request.backgroundCrop.zoom}% with focus ${request.backgroundCrop.focusX}/${request.backgroundCrop.focusY}`,
          `anime stylization strength ${request.styleStrength}%`,
        ]
          .filter(Boolean)
          .join(", ");

  const direction = [
    characters.length > 1
      ? [
          characters.length === 2 ? "duo composition" : `group composition with exactly ${characters.length} characters`,
          "show all selected characters together in one frame",
          "keep the selected characters distinct from one another",
          "do not add extra people or duplicate anyone",
          "use natural spacing, eye-lines, and interaction between the selected characters",
        ].join(", ")
      : "",
    buildCameraDistancePrompt(request.cameraDistance),
    resolveGenerationFieldOption(request, "bodyPosture").prompt,
    resolveGenerationFieldOption(request, "pose").prompt,
    resolveGenerationFieldOption(request, "expression").prompt,
    getOption(catalog.aspectRatios, request.aspectRatio).prompt,
    resolveGenerationFieldOption(request, "placement").prompt,
    buildOutfitDirectionPrompt(request, characters.length),
    getOption(catalog.consistencyModes, request.consistencyMode).prompt,
    resolveGenerationFieldOption(request, "characterRenderStyle").prompt,
    buildCodexPoseIdentityPrompt(options?.codexPosePriority),
    request.variationOfJobId ? "create a fresh variation while preserving the previous successful setup" : "",
    options?.variationSource ? `variation source prompt: ${options.variationSource.prompt}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    characterCore: buildCompositeCharacterIdentityPrompt(characters),
    characterFlex: buildCompositeCharacterVariationPrompt(characters),
    scene: scenePrompt,
    direction,
    qualityGuard:
      characters.length > 1
        ? `exactly ${characters.length} selected characters, every selected character clearly visible, distinct faces, stable body proportions, clean hands, believable scale, detailed anime illustration`
        : "single character, consistent face, stable body proportions, clean hands, believable scale, detailed anime illustration",
    negative: buildCompositeNegativePrompt(characters),
  };
}

export function joinPromptBreakdown(breakdown: PromptBreakdown) {
  return [
    breakdown.characterCore,
    breakdown.characterFlex,
    breakdown.scene,
    breakdown.direction,
    breakdown.qualityGuard,
    breakdown.negative,
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildGenerationPrompt(
  character: CharacterSpec | CharacterSpec[],
  request: GenerationRequestInput,
  options?: GenerationPromptOptions,
) {
  const breakdown = buildGenerationBreakdown(character, request, options);

  return {
    prompt: joinPromptBreakdown(breakdown),
    breakdown,
    negativePrompt: breakdown.negative,
  };
}
