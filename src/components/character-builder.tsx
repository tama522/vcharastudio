"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { startTransition, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  catalog,
  defaultDraft,
  getOption,
  resolveDraftAccessoryLabels,
  resolveDraftColorPalette,
  resolveDraftColorSwatches,
  resolveDraftFieldOption,
} from "@/lib/catalog";
import type {
  CharacterCatalogOption,
  CharacterColorPalette,
  CharacterCustomField,
  CharacterDraftInput,
  CharacterSpec,
  ReferencePack,
} from "@/lib/types";

const presetOutfitOptions = catalog.outfits.filter(
  (option) => option.id !== "custom-coord" && option.id !== "custom-text",
);

type OverviewSection = {
  key: "sex" | "ageGroup" | "genderPresentation" | "facePreset" | "bodyPreset" | "colorway" | "outfitPattern" | "onePoint";
  title: string;
  options: CharacterCatalogOption[];
  subtitle?: string;
  customField?: CharacterCustomField;
  control?: "cards" | "select" | "chips" | "slider";
  compactCards?: boolean;
  hideCount?: boolean;
};

const overviewSections: OverviewSection[] = [
  {
    key: "sex",
    title: "Sex",
    options: catalog.sexes,
  },
  {
    key: "ageGroup",
    title: "Age",
    options: catalog.ageGroups,
    control: "slider",
    hideCount: true,
  },
  {
    key: "genderPresentation",
    title: "Personality",
    options: catalog.genderPresentations,
    customField: "genderPresentation",
    control: "select",
    hideCount: true,
  },
  {
    key: "facePreset",
    title: "Mood",
    options: catalog.facePresets,
    customField: "facePreset",
    control: "chips",
    hideCount: true,
  },
  {
    key: "bodyPreset",
    title: "Body Impression",
    options: catalog.bodyPresets,
    customField: "bodyPreset",
    control: "chips",
    hideCount: true,
  },
];

const detailOverviewSections: OverviewSection[] = [
  {
    key: "colorway",
    title: "Color",
    options: catalog.colorways,
  },
  {
    key: "outfitPattern",
    title: "Pattern",
    options: catalog.outfitPatterns,
    customField: "outfitPattern",
  },
  {
    key: "onePoint",
    title: "Accent",
    options: catalog.onePoints,
    customField: "onePoint",
    control: "chips",
    hideCount: true,
  },
];

const detailSections = [
  { key: "hairStyle", title: "Hairstyle", options: catalog.hairStyles, customField: "hairStyle" },
  { key: "hairColor", title: "Hair Color", options: catalog.hairColors, customField: "hairColor" },
  { key: "bangs", title: "Bangs", options: catalog.bangs, customField: "bangs" },
  { key: "eyes", title: "Eyes", options: catalog.eyes, customField: "eyes" },
  { key: "eyebrows", title: "Eyebrows", options: catalog.eyebrows, customField: "eyebrows" },
  { key: "mouth", title: "Mouth", options: catalog.mouth, customField: "mouth" },
  { key: "faceShape", title: "Face Shape", options: catalog.faceShapes, customField: "faceShape" },
  { key: "skinTone", title: "Skin Tone", options: catalog.skinTones, customField: "skinTone" },
  { key: "heightProfile", title: "Height", options: catalog.heightProfiles, customField: "heightProfile" },
  { key: "bodyType", title: "Body Type", options: catalog.bodyTypes, customField: "bodyType" },
  { key: "outfitMaterial", title: "Outfit Material", options: catalog.outfitMaterials, customField: "outfitMaterial" },
] as const;

type SingleSelectField =
  | (typeof overviewSections)[number]["key"]
  | (typeof detailSections)[number]["key"]
  | (typeof detailOverviewSections)[number]["key"]
  | "outfit";

const outfitGenreOptions = [
  { id: "unspecified", label: "Unspecified" },
  { id: "daily-room", label: "Daily / Room" },
  { id: "pants", label: "Pants" },
  { id: "skirt", label: "Skirt" },
  { id: "onepiece", label: "One-piece" },
  { id: "uniform-wear", label: "Uniform / Wear" },
  { id: "wa-retro", label: "Japanese / Retro" },
  { id: "stage-costume", label: "Stage / Costume" },
  { id: "cosplay", label: "Cosplay" },
] as const;

const outfitGenreMap = {
  unspecified: presetOutfitOptions.map((option) => option.id),
  "daily-room": ["cafe-knit", "hoodie-street", "denim-layered", "outing-spring", "outing-summer", "outing-autumn", "outing-winter", "room-jersey", "soft-pajama", "kigurumi-fluffy", "kigurumi-loose", "knit-onepiece"],
  pants: ["travel-coat", "techwear", "denim-layered", "outing-spring", "outing-summer", "outing-autumn", "outing-winter", "room-jersey", "office-smart", "biker-leather", "military-jacket", "showa-50s-retro", "heisei-early-pop"],
  skirt: ["cafe-knit", "preppy-tennis", "school-modern", "sailor-classic", "outing-spring", "outing-summer", "outing-autumn", "sixties-mod", "retro-marine", "taisho-retro"],
  onepiece: ["knit-onepiece", "soft-pajama", "gothic-lolita", "sweet-lolita", "maid-classic", "maid-frill", "witch-dress", "wa-lolita", "china-dress", "princess-fantasy"],
  "uniform-wear": ["school-modern", "sailor-classic", "jersey-sport", "office-smart", "lab-coat", "nurse-soft", "cafe-apron", "hakama-taisho", "police-costume"],
  "wa-retro": ["kimono-modern", "classic-kimono", "furisode-formal", "hakama-taisho", "haori-modern", "wa-lolita", "yukata-summer", "shrine-maiden", "ninja-costume", "taisho-retro", "showa-50s-retro", "sixties-mod", "heisei-early-pop", "retro-marine", "showa-idol"],
  "stage-costume": ["idol-stage", "dance-performance", "bunny-girl", "showa-idol", "gothic-lolita", "sweet-lolita", "maid-classic", "maid-frill", "magical-girl", "princess-fantasy", "china-dress"],
  cosplay: ["idol-stage", "dance-performance", "bunny-girl", "showa-idol", "gothic-lolita", "sweet-lolita", "maid-classic", "maid-frill", "kimono-modern", "classic-kimono", "furisode-formal", "hakama-taisho", "haori-modern", "wa-lolita", "yukata-summer", "shrine-maiden", "ninja-costume", "fantasy-robe", "witch-dress", "magical-girl", "princess-fantasy", "vampire-noble", "steampunk-costume", "china-dress", "police-costume", "cyber-android", "taisho-retro"],
} satisfies Record<(typeof outfitGenreOptions)[number]["id"], string[]>;

function createDraftState(initialDraft?: CharacterDraftInput) {
  return structuredClone(initialDraft ?? defaultDraft);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function optionCountLabel(count: number) {
  return `${count} types`;
}

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    fieldErrors?: Array<{ message?: string }>;
  };

  return payload.fieldErrors?.[0]?.message || payload.message || "API request failed";
}

function hasVisibleLabel(label: string) {
  return Boolean(label) && label !== "Unspecified" && label !== "None";
}

function ColorSwatches({ swatches }: { swatches?: string[] }) {
  if (!swatches?.length) return null;

  return (
    <div className="color-swatch-row" aria-hidden="true">
      {swatches.slice(0, 5).map((swatch, index) => (
        <span
          key={`${swatch}-${index}`}
          className="color-swatch"
          style={{ backgroundColor: swatch }}
        />
      ))}
    </div>
  );
}

function CustomFieldInput({
  title,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="custom-field-inline" aria-label={`${title}Custom Text`}>
      <span className="custom-field-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M10.8 2.2a1.7 1.7 0 1 1 2.4 2.4L6 11.8 3 12.5l.7-3 7.1-7.3Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <input
        className="input input-compact"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Enter only when needed"}
      />
    </label>
  );
}

function OptionCard({
  option,
  selected,
  onClick,
  compact = false,
}: {
  option: CharacterCatalogOption;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`option-card ${compact ? "option-card-compact" : ""} ${selected ? "is-selected" : ""}`}
      type="button"
      onClick={onClick}
    >
      <div className="option-card-body">
        <div className="option-card-row">
          <span className="option-card-title">{option.label}</span>
          {option.badge ? <span className="option-card-badge">{option.badge}</span> : null}
        </div>
        <ColorSwatches swatches={option.swatches} />
      </div>
    </button>
  );
}

export function CharacterBuilder({
  initialCount,
  initialDraft,
  isSignedIn = true,
  regenerateCharacterId,
}: {
  initialCount: number;
  initialDraft?: CharacterDraftInput;
  isSignedIn?: boolean;
  regenerateCharacterId?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CharacterDraftInput>(() => createDraftState(initialDraft));
  const [outfitGenre, setOutfitGenre] = useState<(typeof outfitGenreOptions)[number]["id"]>("unspecified");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCharacter, setCreatedCharacter] = useState<CharacterSpec | null>(null);
  const [referencePack, setReferencePack] = useState<ReferencePack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnonymousPrompt, setShowAnonymousPrompt] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const isSeparateOutfit = draft.outfitSelectionMode === "separate";
  const colorPalette = resolveDraftColorPalette(draft);
  const colorSwatches = resolveDraftColorSwatches(draft);
  const ageGroupIndex = Math.max(0, catalog.ageGroups.findIndex((option) => option.id === draft.ageGroup));
  const filteredPresetOutfitOptions = presetOutfitOptions.filter((option) => outfitGenreMap[outfitGenre].includes(option.id));
  const outfitSummary = isSeparateOutfit
    ? [
        resolveDraftFieldOption(draft, "innerwear").label,
        resolveDraftFieldOption(draft, "bottoms").label,
        resolveDraftFieldOption(draft, "outerwear").label,
      ]
        .filter(hasVisibleLabel)
        .join(" / ")
    : resolveDraftFieldOption(draft, "outfit").label;
  const summary = [
    getOption(catalog.outfitSelectionModes, draft.outfitSelectionMode).label,
    getOption(catalog.sexes, draft.sex).label,
    getOption(catalog.ageGroups, draft.ageGroup).label,
    hasVisibleLabel(resolveDraftFieldOption(draft, "genderPresentation").label)
      ? resolveDraftFieldOption(draft, "genderPresentation").label
      : "",
    hasVisibleLabel(resolveDraftFieldOption(draft, "facePreset").label)
      ? resolveDraftFieldOption(draft, "facePreset").label
      : "",
    hasVisibleLabel(resolveDraftFieldOption(draft, "bodyPreset").label)
      ? resolveDraftFieldOption(draft, "bodyPreset").label
      : "",
    hasVisibleLabel(resolveDraftFieldOption(draft, "hairColor").label)
      ? resolveDraftFieldOption(draft, "hairColor").label
      : "",
    hasVisibleLabel(outfitSummary) ? outfitSummary : "",
    draft.colorMode === "custom"
      ? "Custom Color Palette"
      : hasVisibleLabel(getOption(catalog.colorways, draft.colorway).label)
        ? getOption(catalog.colorways, draft.colorway).label
        : "",
  ].filter(Boolean);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function updateDraft<K extends keyof CharacterDraftInput>(key: K, value: CharacterDraftInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateCustomField(field: CharacterCustomField, value: string) {
    setDraft((current) => ({
      ...current,
      customFields: {
        ...current.customFields,
        [field]: value,
      },
    }));
  }

  function updateCustomColor(key: keyof CharacterColorPalette, value: string) {
    setDraft((current) => ({
      ...current,
      colorMode: "custom",
      customColorPalette: {
        ...current.customColorPalette,
        [key]: value,
      },
    }));
  }

  function selectColorway(colorway: string) {
    setDraft((current) => ({
      ...current,
      colorway,
      customColorPalette:
        current.colorMode === "preset"
          ? resolveDraftColorPalette({
              colorMode: "preset",
              colorway,
              customColorPalette: current.customColorPalette,
            })
          : current.customColorPalette,
    }));
  }

  function selectAgeGroup(index: number) {
    const option = catalog.ageGroups[index];
    if (!option) return;
    updateDraft("ageGroup", option.id);
  }

  function toggleAccessory(id: string) {
    setDraft((current) => ({
      ...current,
      accessories: current.accessories.includes(id)
        ? current.accessories.filter((entry) => entry !== id)
        : current.accessories.length >= 4
          ? current.accessories
          : [...current.accessories, id],
    }));
  }

  async function submitCharacter(options?: { anonymous?: boolean }) {
    setIsSubmitting(true);
    setError(null);
    setShowAnonymousPrompt(false);

    const submitDraft = {
      ...draft,
      outfitSelectionMode: regenerateCharacterId ? draft.outfitSelectionMode : "preset",
    } satisfies CharacterDraftInput;

    try {
      const createResponse = await fetch(
        options?.anonymous
          ? "/api/anonymous/builder-generate"
          : regenerateCharacterId
          ? `/api/characters/${regenerateCharacterId}/reference-pack/generate`
          : "/api/characters",
        {
          method: regenerateCharacterId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            regenerateCharacterId
              ? { regenerate: true, draft: submitDraft }
              : submitDraft,
          ),
        },
      );

      if (!createResponse.ok) {
        throw new Error(await readApiError(createResponse));
      }

      if (regenerateCharacterId) {
        const regenerated = (await createResponse.json()) as {
          character: CharacterSpec;
          referencePack: ReferencePack;
        };
        setCreatedCharacter(regenerated.character);
        setReferencePack(regenerated.referencePack);
        startTransition(() => {
          router.push(`/characters/${regenerateCharacterId}?previewReferencePackId=${regenerated.referencePack.id}`);
          router.refresh();
        });
        return;
      }

      if (options?.anonymous) {
        const generated = (await createResponse.json()) as {
          character: CharacterSpec;
          referencePack: ReferencePack;
        };
        setCreatedCharacter(generated.character);
        setReferencePack(generated.referencePack);
        startTransition(() => {
          router.push(`/builder/complete/${generated.character.id}`);
          router.refresh();
        });
        return;
      }

      const created = (await createResponse.json()) as {
        character: CharacterSpec;
      };

      const referenceResponse = await fetch(`/api/characters/${created.character.id}/reference-pack/generate`, {
        method: "POST",
      });

      if (!referenceResponse.ok) {
        throw new Error(await readApiError(referenceResponse));
      }

      const generated = (await referenceResponse.json()) as { referencePack: ReferencePack };
      setCreatedCharacter(created.character);
      setReferencePack(generated.referencePack);
      startTransition(() => {
        router.push(`/builder/complete/${created.character.id}`);
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "An unknown error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSignedIn && !regenerateCharacterId) {
      setShowAnonymousPrompt(true);
      setError(null);
      return;
    }

    await submitCharacter();
  }

  const generationChoiceModal = showAnonymousPrompt && isMounted ? createPortal((
    <div
      aria-label="Select generation method"
      aria-modal="true"
      className="builder-generation-modal-backdrop"
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(26, 22, 20, 0.42)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="builder-generation-modal-card"
        style={{
          width: "min(100%, 460px)",
          padding: 20,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="builder-generation-modal-head">
          <div>
            <p className="heading-md">Select generation method</p>
            <p className="surface-copy">
              Sign in with Google to create a saved workspace. Anonymous users can use one form generation while the daily trial quota is available.
            </p>
          </div>
          <button
            aria-label="Close"
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setShowAnonymousPrompt(false)}
          >
            ×
          </button>
        </div>
        <div className="sign-in-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void signIn("google", { callbackUrl: "/api/anonymous/claim?next=/builder" })}
          >
            Sign in with Google
          </button>
          <button
            className="btn btn-secondary"
            disabled={isSubmitting}
            type="button"
            onClick={() => void submitCharacter({ anonymous: true })}
          >
            Generate Anonymously
          </button>
        </div>
      </div>
    </div>
  ), document.body) : null;

  return (
    <>
      <div className="two-col">
      <form className="card card-padded" id="character-builder-form" onSubmit={handleSubmit}>
        <div className="form-stack">
          <div className="stack-sm">
            <p className="form-section-title">Basic Info</p>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="name">Character Name</label>
              <input
                className="input"
                id="name"
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="tagline">Tagline</label>
              <input
                className="input"
                id="tagline"
                value={draft.tagline}
                onChange={(event) => updateDraft("tagline", event.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="story">Character Notes</label>
            <textarea
              className="textarea textarea-compact"
              id="story"
              value={draft.story}
              onChange={(event) => updateDraft("story", event.target.value)}
              placeholder="Enter settings"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="negativePrompt">Negative Prompt</label>
            <textarea
              className="textarea textarea-compact"
              id="negativePrompt"
              value={draft.negativePrompt}
              onChange={(event) => updateDraft("negativePrompt", event.target.value)}
              placeholder="Enter things to avoid"
            />
          </div>

          <div className="builder-section">
            <div className="builder-section-head">
              <p className="form-section-title">Start Broad</p>
            </div>

            <div className="overview-stack">
              {overviewSections.map((section) => {
                const customField = "customField" in section ? section.customField : undefined;

                return (
                  <div className="selector-group selector-group-card" key={section.key}>
                    <div className="selector-group-head">
                      <div>
                        <span className="selector-group-label">{section.title}</span>
                        {section.subtitle ? <p className="selector-group-subtitle">{section.subtitle}</p> : null}
                      </div>
                      {!section.hideCount ? <span className="chip chip-soft">{optionCountLabel(section.options.length)}</span> : null}
                    </div>

                    {section.control === "slider" ? (
                      <div className="slider-stack builder-slider-stack">
                        <div className="field-row">
                          <span className="field-label">{catalog.ageGroups[ageGroupIndex]?.label}</span>
                        </div>
                        <input
                          aria-label="Age"
                          max={catalog.ageGroups.length - 1}
                          min={0}
                          step={1}
                          type="range"
                          value={ageGroupIndex}
                          onChange={(event) => selectAgeGroup(Number(event.target.value))}
                        />
                        <div className="slider-range-labels">
                          <span>{catalog.ageGroups[0]?.label}</span>
                          <span>{catalog.ageGroups.at(-1)?.label}</span>
                        </div>
                      </div>
                    ) : section.control === "select" ? (
                      <select
                        className="select select-compact"
                        value={draft[section.key]}
                        onChange={(event) => updateDraft(section.key as SingleSelectField, event.target.value)}
                      >
                        {section.options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : section.control === "chips" ? (
                      <div className="option-grid option-grid-compact">
                        {section.options.map((option) => (
                          <button
                            key={option.id}
                            className={`chip chip-selectable chip-compact ${draft[section.key] === option.id ? "chip-selected" : ""}`}
                            type="button"
                            onClick={() => updateDraft(section.key as SingleSelectField, option.id)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="option-card-grid">
                        {section.options.map((option) => (
                          <OptionCard
                            key={option.id}
                            compact={section.compactCards}
                            option={option}
                            selected={draft[section.key] === option.id}
                            onClick={() =>
                              section.key === "colorway"
                                ? selectColorway(option.id)
                                : updateDraft(section.key as SingleSelectField, option.id)
                            }
                          />
                        ))}
                      </div>
                    )}

                    {section.key === "colorway" ? (
                      <div className="custom-field-box color-picker-panel">
                        <div className="field-row">
                          <label className="field-label">Color Mode</label>
                          <div className="chip-row">
                            <button
                              className={`chip chip-selectable ${draft.colorMode === "preset" ? "chip-selected" : ""}`}
                              type="button"
                              onClick={() => updateDraft("colorMode", "preset")}
                            >
                              Preset
                            </button>
                            <button
                              className={`chip chip-selectable ${draft.colorMode === "custom" ? "chip-selected" : ""}`}
                              type="button"
                              onClick={() => updateDraft("colorMode", "custom")}
                            >
                              Color Picker
                            </button>
                          </div>
                        </div>
                        <div className="color-picker-grid">
                          {([
                            ["primary", "Primary"],
                            ["secondary", "Secondary"],
                            ["accent", "Accent 1"],
                            ["detail", "Accent 2"],
                            ["highlight", "Accent 3"],
                          ] as const).map(([key, label]) => (
                            <label className="color-picker-card" key={key}>
                              <span className="field-label">{label}</span>
                              <div className="color-input-row">
                                <input
                                  className="color-input"
                                  type="color"
                                  value={colorPalette[key]}
                                  onChange={(event) => updateCustomColor(key, event.target.value)}
                                />
                                <input
                                  className="input"
                                  value={colorPalette[key]}
                                  onChange={(event) => updateCustomColor(key, event.target.value)}
                                />
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : customField ? (
                      <CustomFieldInput
                        title={section.title}
                        value={draft.customFields[customField] ?? ""}
                        onChange={(value) => updateCustomField(customField, value)}
                      />
                    ) : null}
                  </div>
                );
              })}

              <div className="selector-group selector-group-card">
                <div className="selector-group-head">
                  <div>
                    <span className="selector-group-label">Full Outfit</span>
                  </div>
                  <span className="chip chip-soft">{optionCountLabel(filteredPresetOutfitOptions.length)}</span>
                </div>
                <div className="selector-group">
                  <span className="field-label">Genre</span>
                  <div className="filter-chip-row" role="tablist" aria-label="Full outfit genre">
                    {outfitGenreOptions.map((option) => (
                      <button
                        key={option.id}
                        aria-selected={outfitGenre === option.id}
                        className={`chip chip-selectable ${outfitGenre === option.id ? "chip-selected" : ""}`}
                        role="tab"
                        type="button"
                        onClick={() => setOutfitGenre(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="option-card-grid">
                  {filteredPresetOutfitOptions.map((option) => (
                    <OptionCard
                      key={option.id}
                      option={option}
                      selected={draft.outfit === option.id}
                      onClick={() => updateDraft("outfit", option.id)}
                    />
                  ))}
                </div>
                <CustomFieldInput
                  title="Full Outfit"
                  value={draft.customFields.outfit ?? ""}
                  onChange={(value) => updateCustomField("outfit", value)}
                />
              </div>
            </div>
          </div>

          <div className="builder-section">
            <button
              aria-expanded={isDetailOpen}
              className="detail-toggle"
              type="button"
              onClick={() => setIsDetailOpen((current) => !current)}
            >
              <span className="detail-toggle-text">Advanced Settings</span>
              <span className="detail-toggle-icon" aria-hidden="true">{isDetailOpen ? "−" : "+"}</span>
            </button>

            {isDetailOpen ? (
              <div className="detail-panel">
                <div className="overview-stack">
                  {detailOverviewSections.map((section) => {
                    const customField = section.customField;

                    return (
                      <div className="selector-group selector-group-card" key={section.key}>
                        <div className="selector-group-head">
                          <div>
                            <span className="selector-group-label">{section.title}</span>
                          </div>
                          {!section.hideCount ? <span className="chip chip-soft">{optionCountLabel(section.options.length)}</span> : null}
                        </div>

                        {section.control === "chips" ? (
                          <div className="option-grid option-grid-compact">
                            {section.options.map((option) => (
                              <button
                                key={option.id}
                                className={`chip chip-selectable chip-compact ${draft[section.key] === option.id ? "chip-selected" : ""}`}
                                type="button"
                                onClick={() => updateDraft(section.key as SingleSelectField, option.id)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="option-card-grid">
                            {section.options.map((option) => (
                              <OptionCard
                                key={option.id}
                                option={option}
                                selected={draft[section.key] === option.id}
                                onClick={() =>
                                  section.key === "colorway"
                                    ? selectColorway(option.id)
                                    : updateDraft(section.key as SingleSelectField, option.id)
                                }
                              />
                            ))}
                          </div>
                        )}

                        {section.key === "colorway" ? (
                          <div className="custom-field-box color-picker-panel">
                            <div className="field-row">
                              <label className="field-label">Color Mode</label>
                              <div className="chip-row">
                                <button
                                  className={`chip chip-selectable ${draft.colorMode === "preset" ? "chip-selected" : ""}`}
                                  type="button"
                                  onClick={() => updateDraft("colorMode", "preset")}
                                >
                                  Preset
                                </button>
                                <button
                                  className={`chip chip-selectable ${draft.colorMode === "custom" ? "chip-selected" : ""}`}
                                  type="button"
                                  onClick={() => updateDraft("colorMode", "custom")}
                                >
                                  Color Picker
                                </button>
                              </div>
                            </div>
                            <div className="color-picker-grid">
                              {([
                                ["primary", "Primary"],
                                ["secondary", "Secondary"],
                                ["accent", "Accent 1"],
                                ["detail", "Accent 2"],
                                ["highlight", "Accent 3"],
                              ] as const).map(([key, label]) => (
                                <label className="color-picker-card" key={key}>
                                  <span className="field-label">{label}</span>
                                  <div className="color-input-row">
                                    <input
                                      className="color-input"
                                      type="color"
                                      value={colorPalette[key]}
                                      onChange={(event) => updateCustomColor(key, event.target.value)}
                                    />
                                    <input
                                      className="input input-compact"
                                      value={colorPalette[key]}
                                      onChange={(event) => updateCustomColor(key, event.target.value)}
                                    />
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : customField ? (
                          <CustomFieldInput
                            title={section.title}
                            value={draft.customFields[customField] ?? ""}
                            onChange={(value) => updateCustomField(customField, value)}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="selector-grid">
                  {detailSections.map((section) => (
                    <div className="selector-group" key={section.key}>
                      <div className="selector-group-head">
                        <span className="selector-group-label">{section.title}</span>
                        <span className="field-hint">{optionCountLabel(section.options.length)}</span>
                      </div>
                    <div className="option-grid">
                      {section.options.map((option) => (
                        <button
                          key={option.id}
                          className={`chip chip-selectable chip-compact ${draft[section.key] === option.id ? "chip-selected" : ""}`}
                          type="button"
                          onClick={() => updateDraft(section.key as SingleSelectField, option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <CustomFieldInput
                      title={section.title}
                      value={draft.customFields[section.customField] ?? ""}
                      onChange={(value) => updateCustomField(section.customField, value)}
                    />
                  </div>
                  ))}
                </div>

                <div className="builder-subgrid">
                  <div className="field">
                    <label className="field-label" htmlFor="customMarkText">Text Accent</label>
                    <input
                      className="input input-compact"
                      id="customMarkText"
                      maxLength={24}
                      value={draft.customMarkText}
                      onChange={(event) => updateDraft("customMarkText", event.target.value)}
                      placeholder="Enter text"
                    />
                  </div>
                </div>

                <div className="builder-subgrid">
                  <div className="selector-group">
                    <div className="selector-group-head">
                      <span className="selector-group-label">Accessories</span>
                      <span className="field-hint">Up to 4</span>
                    </div>
                    <div className="option-grid">
                      {catalog.accessories.map((option) => {
                        const selected = draft.accessories.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            className={`chip chip-selectable chip-compact ${selected ? "chip-selected" : ""}`}
                            type="button"
                            onClick={() => toggleAccessory(option.id)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="customAccessoryNotes">AccessoriesCustom Text</label>
                    <textarea
                      className="textarea textarea-compact"
                      id="customAccessoryNotes"
                      value={draft.customAccessoryNotes}
                      onChange={(event) => updateDraft("customAccessoryNotes", event.target.value)}
                      placeholder="Enter accessories"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="selector-group">
            <div className="selector-group-head">
              <span className="selector-group-label">Custom Text Preview</span>
            </div>
            <div className="chip-row">
              {resolveDraftAccessoryLabels(draft).map((item, index) => (
                <span className="chip chip-soft" key={`${item}-${index}`}>{item}</span>
              ))}
            </div>
          </div>

          <div className="floating-submit-spacer" />

          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </form>

      <div className="floating-submit-bar">
        <div className="floating-submit-inner">
          <button className="btn btn-primary btn-block" disabled={isSubmitting} form="character-builder-form" type="submit">
            {isSubmitting
              ? "Generating..."
              : regenerateCharacterId
                ? "Regenerate References with Settings"
                : "Create Character + Generate Reference Sheet"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => {
              setDraft(createDraftState());
              setOutfitGenre("unspecified");
              setIsDetailOpen(false);
              setCreatedCharacter(null);
              setReferencePack(null);
              setError(null);
              setShowAnonymousPrompt(false);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="stack-lg builder-side-column">
        <div className="side-panel">
          <h3 className="heading-md">Preview</h3>
          <div className="chip-row">
            {summary.map((item, index) => (
              <span className="chip chip-soft" key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
          <ColorSwatches swatches={colorSwatches} />
          <div className="stack-xs">
            <p className="text-sm text-secondary">
              Currently, {presetOutfitOptions.length} types full outfits can be filtered by genre.
            </p>
            <p className="text-xs text-tertiary">Registered: {initialCount} Character</p>
          </div>
        </div>

        <div className="side-panel">
          <h3 className="heading-md">Reference</h3>
          {createdCharacter && referencePack ? (
            <div className="stack-md">
              <div className="stack-xs">
                <p className="heading-sm">{createdCharacter.name}</p>
                <p className="text-sm text-secondary">{createdCharacter.tagline}</p>
                <p className="text-xs text-tertiary">{formatTimestamp(createdCharacter.createdAt)}</p>
              </div>
              <div className="ref-grid">
                {referencePack.images.map((image) => (
                  <div className="ref-card" key={image.id}>
                    <Image
                      alt={image.label}
                      src={image.imageUrl}
                      width={960}
                      height={1200}
                      sizes="(max-width: 768px) 100vw, 25vw"
                      unoptimized
                    />
                    <p className="ref-card-label">{image.label}</p>
                  </div>
                ))}
              </div>
              <div className="btn-row">
                <Link className="btn btn-primary btn-sm" href={`/studio?characterId=${createdCharacter.id}`}>
                  Open Studio
                </Link>
                <Link className="btn btn-secondary btn-sm" href={`/album?characterId=${createdCharacter.id}`}>
                  Album
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-secondary">
              After creation, a reference sheet with front, side, back, and six expressions will appear here.
            </p>
          )}
        </div>
      </div>
      </div>
      {generationChoiceModal}
    </>
  );
}
