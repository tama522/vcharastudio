import type { CharacterParts, ReferenceImageKind } from "@/lib/types";

export interface DefaultCharacterTemplate {
  key: string;
  name: string;
  tagline: string;
  story: string;
  negativePrompt: string;
  source: "existing-assets";
  parts: CharacterParts;
  normalizedPrompt: string;
  referencePack: {
    provider: "user-codex";
    origin: "uploaded";
    version: number;
    prompt: string;
    fixedPrompt: string;
    variationPrompt: string;
    negativePrompt: string;
    seed: number;
    image: {
      kind: ReferenceImageKind;
      label: string;
      prompt: string;
      mimeType: string;
      width: number;
      height: number;
      fileName: string;
      assetName: string;
    };
  };
}

const sharedParts = {
  outfitSelectionMode: "preset",
  outfitSelectionModeLabel: "Preset Outfit",
  sex: "female",
  sexLabel: "Female",
  ageGroup: "24",
  ageGroupLabel: "24",
  genderPresentation: "unspecified",
  genderPresentationLabel: "Unspecified",
  facePreset: "unspecified",
  facePresetLabel: "Unspecified",
  bodyPreset: "unspecified",
  bodyPresetLabel: "Unspecified",
  hairStyle: "unspecified",
  hairStyleLabel: "Unspecified",
  hairColor: "unspecified",
  hairColorLabel: "Unspecified",
  bangs: "unspecified",
  bangsLabel: "Unspecified",
  eyes: "unspecified",
  eyesLabel: "Unspecified",
  eyebrows: "unspecified",
  eyebrowsLabel: "Unspecified",
  mouth: "unspecified",
  mouthLabel: "Unspecified",
  faceShape: "unspecified",
  faceShapeLabel: "Unspecified",
  skinTone: "unspecified",
  skinToneLabel: "Unspecified",
  heightProfile: "unspecified",
  heightProfileLabel: "Unspecified",
  bodyType: "unspecified",
  bodyTypeLabel: "Unspecified",
  outfit: "unspecified",
  outfitLabel: "",
  outfitMaterial: "unspecified",
  outfitMaterialLabel: "Unspecified",
  outfitPattern: "unspecified",
  outfitPatternLabel: "Unspecified",
  colorway: "unspecified",
  colorwayLabel: "Unspecified",
  colorMode: "preset",
  colorPalette: {
    primary: "#ef7f69",
    secondary: "#7aa088",
    accent: "#fff2e8",
    detail: "#2f3f54",
    highlight: "#f6d66a",
  },
  outerwear: "unspecified",
  outerwearLabel: "Unspecified",
  innerwear: "unspecified",
  innerwearLabel: "Unspecified",
  bottoms: "unspecified",
  bottomsLabel: "Unspecified",
  shoes: "unspecified",
  shoesLabel: "Unspecified",
  socks: "unspecified",
  socksLabel: "Unspecified",
  gloves: "unspecified",
  glovesLabel: "Unspecified",
  hat: "unspecified",
  hatLabel: "Unspecified",
  onePoint: "unspecified",
  onePointLabel: "Unspecified",
  customFields: {},
  customMarkText: "",
  outfitDetailNotes: "",
  accessories: [],
  accessoriesLabel: [],
  customAccessoryNotes: "",
} satisfies CharacterParts;

export const defaultCharacterTemplates: DefaultCharacterTemplate[] = [
  {
    key: "sample-character",
    name: "Sample Character",
    tagline: "Placeholder character for the public template",
    story: "Replace this with your own character assets.",
    negativePrompt: "extra fingers, cropped feet, broken lighting, distorted room scale",
    source: "existing-assets",
    parts: sharedParts,
    normalizedPrompt:
      "anime character reference sheet, cohesive design, polished linework, stable silhouette, original sample character, neutral placeholder design",
    referencePack: {
      provider: "user-codex",
      origin: "uploaded",
      version: 1,
      prompt:
        "anime character reference sheet, cohesive design, polished linework, stable silhouette, original sample character, neutral placeholder design, single premium character reference sheet, minimalist editorial layout, simple and very stylish design board, title only, no captions, no labels, no extra text, one full-body front view, one full-body side view, one full-body back view, six facial expressions showing neutral, very happy, heart-eyes in love, surprised, teary, and frustrated emotions, clean spacing, white or soft neutral backdrop, no props, no clutter, anime style reference artwork, plain refined backdrop, strong character consistency, same costume across all panels, highly readable silhouette, polished fashion illustration finish, avoid: extra fingers, cropped feet, broken lighting, distorted room scale",
      fixedPrompt:
        "keep the same face, hair silhouette, body proportions, signature colors, and overall vibe, anime character reference sheet, cohesive design, polished linework, stable silhouette, original sample character, neutral placeholder design",
      variationPrompt: "original sample character, allow pose, framing, and styling variation within the established design",
      negativePrompt: "avoid: extra fingers, cropped feet, broken lighting, distorted room scale",
      seed: 100001,
      image: {
        kind: "reference-sheet",
        label: "Registered Reference",
        prompt:
          "anime character reference sheet, cohesive design, polished linework, stable silhouette, original sample character, neutral placeholder design, single premium character reference sheet, minimalist editorial layout, simple and very stylish design board, title only, no captions, no labels, no extra text, one full-body front view, one full-body side view, one full-body back view, six facial expressions showing neutral, very happy, heart-eyes in love, surprised, teary, and frustrated emotions, clean spacing, white or soft neutral backdrop, no props, no clutter, anime style reference artwork, plain refined backdrop, strong character consistency, same costume across all panels, highly readable silhouette, polished fashion illustration finish, avoid: extra fingers, cropped feet, broken lighting, distorted room scale",
        mimeType: "image/svg+xml",
        width: 959,
        height: 1098,
        fileName: "default-character-placeholder.svg",
        assetName: "default-character-placeholder.svg",
      },
    },
  },
];
