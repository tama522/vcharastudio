import Link from "next/link";
import { notFound } from "next/navigation";
import { ZoomableImage } from "@/components/zoomable-image";
import { getCurrentActor } from "@/lib/auth";
import { listAssets, listCharacters, listReferencePacks } from "@/lib/app-repository";

export const dynamic = "force-dynamic";

type SummaryRow = {
  label: string;
  value: string;
  multiline?: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayValue(value: string | undefined, empty = "Unspecified") {
  const normalized = String(value ?? "").trim();
  return normalized || empty;
}

function displayList(values: string[] | undefined, empty = "None") {
  const items = (values ?? []).map((item) => item.trim()).filter(Boolean);
  return items.length ? items.join(" / ") : empty;
}

export default async function BuilderCompletePage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const [{ characterId }, actor] = await Promise.all([params, getCurrentActor()]);
  if (!actor) {
    notFound();
  }

  const [characters, referencePacks, assets] = await Promise.all([
    listCharacters(actor.id),
    listReferencePacks(actor.id),
    listAssets(actor.id),
  ]);

  const character = characters.find((item) => item.id === characterId);
  const referencePack = referencePacks
    .filter((item) => item.characterId === characterId)
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))[0];

  if (!character || !referencePack) {
    notFound();
  }

  const sheet =
    referencePack.images.find((image) => image.kind === "reference-sheet") ??
    referencePack.images[0];
  const referenceAssets = referencePack.images
    .map((image) => {
      const asset = assets.find((item) => item.id === image.assetId);
      if (!asset) return undefined;

      return {
        image,
        asset,
      };
    })
    .filter((item): item is { image: typeof referencePack.images[number]; asset: (typeof assets)[number] } => Boolean(item));

  if (!sheet || referenceAssets.length === 0) {
    notFound();
  }

  const summaryRows: SummaryRow[] =
    character.source === "existing-assets"
      ? [
          { label: "Source", value: "Existing Images" },
          { label: "Tagline", value: displayValue(character.tagline, "Empty") },
          { label: "Character Notes", value: displayValue(character.story, "Empty"), multiline: true },
          { label: "Reference Images", value: `${referencePack.images.length} images` },
          { label: "Reference Type", value: referencePack.origin === "uploaded" ? "Uploaded" : "Generated Sheet" },
          { label: "Sheet", value: `v${referencePack.version}` },
        ]
      : [
          { label: "Source", value: "AI Builder" },
          { label: "Tagline", value: displayValue(character.tagline, "Empty") },
          { label: "Character Notes", value: displayValue(character.story, "Empty"), multiline: true },
          { label: "Negative Prompt", value: displayValue(character.negativePrompt, "None"), multiline: true },
          { label: "Outfit Mode", value: displayValue(character.parts.outfitSelectionModeLabel) },
          { label: "Sex", value: displayValue(character.parts.sexLabel) },
          { label: "Visual Age", value: displayValue(character.parts.ageGroupLabel) },
          { label: "Personality", value: displayValue(character.parts.genderPresentationLabel) },
          { label: "Mood", value: displayValue(character.parts.facePresetLabel) },
          { label: "Body Impression", value: displayValue(character.parts.bodyPresetLabel) },
          { label: "Hairstyle", value: displayValue(character.parts.hairStyleLabel) },
          { label: "Hair Color", value: displayValue(character.parts.hairColorLabel) },
          { label: "Bangs", value: displayValue(character.parts.bangsLabel) },
          { label: "Eyes", value: displayValue(character.parts.eyesLabel) },
          { label: "Eyebrows", value: displayValue(character.parts.eyebrowsLabel) },
          { label: "Mouth", value: displayValue(character.parts.mouthLabel) },
          { label: "Face Shape", value: displayValue(character.parts.faceShapeLabel) },
          { label: "Skin Tone", value: displayValue(character.parts.skinToneLabel) },
          { label: "Height", value: displayValue(character.parts.heightProfileLabel) },
          { label: "Body Type", value: displayValue(character.parts.bodyTypeLabel) },
          { label: "Full Outfit", value: displayValue(character.parts.outfitLabel) },
          { label: "Outfit Material", value: displayValue(character.parts.outfitMaterialLabel) },
          { label: "Pattern", value: displayValue(character.parts.outfitPatternLabel) },
          {
            label: "Color Mode",
            value: character.parts.colorMode === "custom" ? "Color Picker" : "Preset",
          },
          { label: "Color Palette", value: displayValue(character.parts.colorwayLabel) },
          {
            label: "Color Details",
            value: [
              character.parts.colorPalette.primary,
              character.parts.colorPalette.secondary,
              character.parts.colorPalette.accent,
              character.parts.colorPalette.detail,
              character.parts.colorPalette.highlight,
            ].join(" / "),
            multiline: true,
          },
          { label: "Outerwear", value: displayValue(character.parts.outerwearLabel) },
          { label: "Innerwear", value: displayValue(character.parts.innerwearLabel) },
          { label: "Bottoms", value: displayValue(character.parts.bottomsLabel) },
          { label: "Shoes", value: displayValue(character.parts.shoesLabel) },
          { label: "Socks / Tights", value: displayValue(character.parts.socksLabel) },
          { label: "Gloves / Hands", value: displayValue(character.parts.glovesLabel) },
          { label: "Hat / Headwear", value: displayValue(character.parts.hatLabel) },
          { label: "Accent", value: displayValue(character.parts.onePointLabel) },
          { label: "Text Accent", value: displayValue(character.parts.customMarkText, "None") },
          { label: "Outfit Notes", value: displayValue(character.parts.outfitDetailNotes, "Empty"), multiline: true },
          { label: "Accessories", value: displayList(character.parts.accessoriesLabel) },
          { label: "Reference Type", value: referencePack.origin === "uploaded" ? "Uploaded" : "Generated Sheet" },
          { label: "Sheet", value: `v${referencePack.version}` },
        ];

  return (
    <div className="page-content">
      <div className="page-title-block">
        <h1 className="heading-xl">
          {character.source === "existing-assets" ? "Character Registration Complete" : "Character Complete"}
        </h1>
        <p className="page-subtitle">
          {character.source === "existing-assets"
            ? "Review the registered reference images, then continue directly to generation."
            : "Review the completed sheet in a larger view, then continue directly to generation."}
        </p>
      </div>

      <div className="completion-layout">
        <div className="completion-preview card">
          {character.source === "existing-assets" ? (
            <div className="completion-preview-inner">
              <div className="registered-reference-grid">
                {referenceAssets.map(({ image, asset }) => (
                  <div className="registered-reference-card" key={image.id}>
                    <div className="registered-reference-media">
                      <ZoomableImage
                        alt={`${character.name} ${image.label}`}
                        height={asset.height}
                        label={`${character.name} / ${image.label}`}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        src={image.imageUrl}
                        width={asset.width}
                      />
                    </div>
                    <p className="ref-card-label">{image.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="completion-preview-inner">
              <ZoomableImage
                alt={`${character.name} Reference Sheet`}
                height={1200}
                label={`${character.name} / Completed Sheet`}
                sizes="(max-width: 768px) 100vw, 68vw"
                src={sheet.imageUrl}
                width={960}
              />
            </div>
          )}
        </div>

        <div className="stack-md">
          <div className="card card-padded">
            <div className="stack-xs">
              <p className="heading-lg">{character.name}</p>
              {character.tagline ? (
                <p className="text-sm text-secondary">{character.tagline}</p>
              ) : null}
              <p className="text-xs text-tertiary">{formatDate(character.createdAt)}</p>
            </div>
            <div className="chip-row" style={{ marginTop: 12 }}>
              <span className={`chip ${character.source === "existing-assets" ? "chip-sage" : "chip-soft"}`}>
                {character.source === "existing-assets" ? "Imported Images" : "AI Builder"}
              </span>
              {character.source === "existing-assets" ? (
                <span className="chip chip-soft">References {referencePack.images.length} images</span>
              ) : (
                <>
                  <span className="chip chip-soft">{character.parts.sexLabel}</span>
                  <span className="chip chip-soft">{character.parts.ageGroupLabel}</span>
                  <span className="chip chip-soft">{character.parts.hairStyleLabel}</span>
                  <span className="chip chip-soft">{character.parts.hairColorLabel}</span>
                  <span className="chip chip-soft">{character.parts.outfitLabel}</span>
                </>
              )}
            </div>
            {character.source === "existing-assets" ? null : (
              <div className="color-swatch-row" style={{ marginTop: 12 }}>
                {[
                  character.parts.colorPalette.primary,
                  character.parts.colorPalette.secondary,
                  character.parts.colorPalette.accent,
                  character.parts.colorPalette.detail,
                  character.parts.colorPalette.highlight,
                ].map((swatch, index) => (
                  <span
                    key={`${swatch}-${index}`}
                    className="color-swatch"
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="card card-padded">
            <h2 className="heading-md">Settings Summary</h2>
            <div className="meta-list" style={{ marginTop: 10 }}>
              {summaryRows.map((row) => (
                <div className={`meta-row ${row.multiline ? "meta-row-top" : ""}`} key={row.label}>
                  <span>{row.label}</span>
                  <strong className={row.multiline ? "meta-row-value-wrap" : ""}>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="completion-actions">
            <Link className="btn btn-primary" href={`/studio?characterId=${character.id}`}>
              Generate with This Character
            </Link>
            <Link className="btn btn-secondary" href="/builder">
              Create Another
            </Link>
            {!actor.isAnonymous ? (
              <Link className="btn btn-ghost" href={`/album?characterId=${character.id}`}>
                View Album
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
