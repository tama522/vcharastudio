import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterReferenceManager } from "@/components/character-reference-manager";
import { requireUser } from "@/lib/auth";
import { characterSummaryRows, formatCharacterSummaryValue } from "@/lib/character-summary";
import {
  listAlbumItems,
  listAssets,
  listCharacters,
  listGenerationJobs,
  listReferencePacks,
} from "@/lib/app-repository";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export default async function CharacterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ previewReferencePackId?: string }>;
}) {
  const [{ id }, { previewReferencePackId }, user] = await Promise.all([params, searchParams, requireUser()]);
  const [characters, referencePacks, albumItems, assets, jobs] = await Promise.all([
    listCharacters(user.id),
    listReferencePacks(user.id),
    listAlbumItems(user.id, id),
    listAssets(user.id),
    listGenerationJobs(user.id),
  ]);

  const character = characters.find((item) => item.id === id);
  if (!character) {
    notFound();
  }

  const characterReferencePacks = referencePacks
    .filter((item) => item.characterId === id)
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt));

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const visibleAlbumItems = albumItems
    .filter((item) => !item.trashedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestGeneratedPhotos = visibleAlbumItems.slice(0, 12);
  const detailRows = characterSummaryRows(character)
    .map((row) => ({
      ...row,
      formattedValue: formatCharacterSummaryValue(row.value, row.multiline ? "Empty" : "Unspecified"),
    }))
    .filter((row) => row.formattedValue);

  return (
    <div className="page-content">
      <div className="page-title-block">
        <div className="page-title-row">
          <div>
            <h1 className="heading-xl">{character.name}</h1>
            {character.tagline ? <p className="page-subtitle">{character.tagline}</p> : null}
          </div>
          <Link className="btn btn-primary btn-sm" href={`/studio?characterId=${character.id}`}>
            Generate with this character
          </Link>
        </div>
      </div>

      <div className="character-detail-layout">
        <CharacterReferenceManager
          assets={assets}
          character={character}
          initialPreviewReferencePackId={previewReferencePackId}
          referencePacks={characterReferencePacks}
        />

        <section className="side-panel">
          <h2 className="heading-md">Generation Settings</h2>
          <div className="meta-list">
            {detailRows.map((row) => (
              <div className={`meta-row ${row.multiline ? "meta-row-top" : ""}`} key={row.label}>
                <span>{row.label}</span>
                <strong className={row.multiline ? "meta-row-value-wrap" : ""}>{row.formattedValue}</strong>
              </div>
            ))}
          </div>
          {character.source === "builder" ? (
            <div className="color-swatch-row">
              {[
                character.parts.colorPalette.primary,
                character.parts.colorPalette.secondary,
                character.parts.colorPalette.accent,
                character.parts.colorPalette.detail,
                character.parts.colorPalette.highlight,
              ].map((swatch, index) => (
                <span
                  className="color-swatch"
                  key={`${swatch}-${index}`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          ) : null}
          <div className="chip-row">
            <span className={`chip ${character.source === "existing-assets" ? "chip-sage" : "chip-soft"}`}>
              {character.source === "existing-assets" ? "Imported Images" : "AI Builder"}
            </span>
            <span className="chip chip-soft">Consistency References {character.consistencyAssetIds.length}  items</span>
            <span className="chip chip-soft">Create {formatDate(character.createdAt)}</span>
          </div>
        </section>
      </div>

      <section className="side-panel">
        <div className="side-panel-head">
          <div>
            <h2 className="heading-md">Photos generated with this character</h2>
            <p className="text-sm text-secondary">{visibleAlbumItems.length}  items</p>
          </div>
          <Link className="btn btn-secondary btn-sm" href={`/album?characterId=${character.id}`}>
            View in Album
          </Link>
        </div>

        {latestGeneratedPhotos.length ? (
          <div className="character-detail-photo-grid">
            {latestGeneratedPhotos.map((item) => {
              const asset = assetsById.get(item.assetId);
              const job = jobsById.get(item.generationJobId);
              return (
                <Link className="character-detail-photo" href={`/result/${item.generationJobId}`} key={item.id}>
                  <div className="album-card-image">
                    {asset ? (
                      <Image
                        alt={item.title}
                        height={asset.height}
                        src={asset.imageUrl}
                        width={asset.width}
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="album-card-info">
                    <div className="chip-row">
                      <span className="chip chip-soft">{job?.variationOfJobId ? "Variation" : "Parent"}</span>
                      <span className="chip chip-sage">{item.sourceMode === "scene-template" ? "Template" : "Photo"}</span>
                    </div>
                    <p className="album-card-title">{item.title}</p>
                    <p className="text-xs text-tertiary">{formatDate(item.createdAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-state-title">No generated photos yet</p>
            <p className="empty-state-text">Generate with this character, then return to results from here.</p>
            <Link className="btn btn-primary" href={`/studio?characterId=${character.id}`}>Generate</Link>
          </div>
        )}
      </section>
    </div>
  );
}
