import type { CharacterSpec } from "@/lib/types";

export type CharacterSummaryRow = {
  label: string;
  value?: string | string[];
  multiline?: boolean;
};

export function formatCharacterSummaryValue(value?: string | string[], empty = "") {
  const values = Array.isArray(value) ? value : [value];
  const text = values.map((item) => item?.trim()).filter(Boolean).join(" / ");
  return text || empty;
}

export function characterSummaryRows(character: CharacterSpec): CharacterSummaryRow[] {
  if (character.source === "existing-assets") {
    return [
      { label: "Source", value: character.isDefaultTemplate ? "Shared Template" : "Imported Images" },
      { label: "Tagline", value: character.tagline },
      { label: "Prompt Notes", value: character.story, multiline: true },
      { label: "Negative Prompt", value: character.negativePrompt, multiline: true },
    ];
  }

  const parts = character.parts;
  return [
    { label: "Tagline", value: character.tagline },
    { label: "Character Notes", value: character.story, multiline: true },
    { label: "Negative Prompt", value: character.negativePrompt, multiline: true },
    { label: "Sex", value: parts.sexLabel },
    { label: "Age", value: parts.ageGroupLabel },
    { label: "Mood", value: parts.genderPresentationLabel },
    { label: "Face", value: parts.facePresetLabel },
    { label: "Body Type", value: [parts.bodyPresetLabel, parts.heightProfileLabel, parts.bodyTypeLabel] },
    { label: "Hair", value: [parts.hairStyleLabel, parts.hairColorLabel, parts.bangsLabel] },
    { label: "Eyes / Expression", value: [parts.eyesLabel, parts.eyebrowsLabel, parts.mouthLabel, parts.faceShapeLabel] },
    { label: "Skin", value: parts.skinToneLabel },
    {
      label: "Outfit",
      value: parts.outfitSelectionMode === "separate"
        ? [parts.outerwearLabel, parts.innerwearLabel, parts.bottomsLabel, parts.shoesLabel, parts.socksLabel, parts.glovesLabel, parts.hatLabel]
        : parts.outfitLabel,
    },
    { label: "Material / Pattern", value: [parts.outfitMaterialLabel, parts.outfitPatternLabel] },
    { label: "Color Palette", value: parts.colorwayLabel },
    { label: "Accent", value: [parts.onePointLabel, parts.customMarkText] },
    { label: "Accessories", value: [...parts.accessoriesLabel, parts.customAccessoryNotes] },
    { label: "Outfit Notes", value: parts.outfitDetailNotes, multiline: true },
  ];
}
