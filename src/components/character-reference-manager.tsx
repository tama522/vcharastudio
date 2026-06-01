"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ZoomableImage } from "@/components/zoomable-image";
import type { Asset, CharacterSpec, ReferencePack } from "@/lib/types";

interface CharacterReferenceManagerProps {
  character: CharacterSpec;
  referencePacks: ReferencePack[];
  assets: Asset[];
  initialPreviewReferencePackId?: string;
}

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    fieldErrors?: Array<{ message?: string }>;
  };

  return payload.fieldErrors?.[0]?.message || payload.message || "API request failed";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export function CharacterReferenceManager({
  character,
  referencePacks,
  assets,
  initialPreviewReferencePackId,
}: CharacterReferenceManagerProps) {
  const router = useRouter();
  const [currentCharacter, setCurrentCharacter] = useState(character);
  const [packList, setPackList] = useState(referencePacks);
  const [previewPackId, setPreviewPackId] = useState(
    initialPreviewReferencePackId ?? character.referencePackId ?? referencePacks[0]?.id ?? "",
  );
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [selectingPackId, setSelectingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedPacks = useMemo(
    () => [...packList].sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt)),
    [packList],
  );
  const activePack =
    sortedPacks.find((pack) => pack.id === previewPackId) ??
    sortedPacks.find((pack) => pack.id === currentCharacter.referencePackId) ??
    sortedPacks[0];
  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const canRegenerate = currentCharacter.source === "builder" && !currentCharacter.isDefaultTemplate;

  async function regenerateSameSettings() {
    if (!canRegenerate) return;
    setIsRegenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/characters/${currentCharacter.id}/reference-pack/generate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as {
        character: CharacterSpec;
        referencePack: ReferencePack;
      };
      setCurrentCharacter(payload.character);
      setPackList((current) => [
        payload.referencePack,
        ...current.filter((pack) => pack.id !== payload.referencePack.id),
      ]);
      setPreviewPackId(payload.referencePack.id);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to regenerate references.");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function selectReferencePack(referencePackId: string) {
    setSelectingPackId(referencePackId);
    setError(null);

    try {
      const response = await fetch(`/api/characters/${currentCharacter.id}/reference-pack/select`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referencePackId }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as {
        character: CharacterSpec;
        referencePack: ReferencePack;
      };
      setCurrentCharacter(payload.character);
      setPreviewPackId(payload.referencePack.id);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to apply the reference.");
    } finally {
      setSelectingPackId(null);
    }
  }

  return (
    <section className="side-panel">
      <div className="side-panel-head">
        <div>
          <h2 className="heading-md">Reference Sheet</h2>
          <p className="text-sm text-secondary">
            {activePack ? `v${activePack.version}  previewing / candidates ${sortedPacks.length}  items` : "Not created"}
          </p>
        </div>
        <Link className="btn btn-secondary btn-sm" href={`/album?characterId=${currentCharacter.id}`}>
          Photo List
        </Link>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {canRegenerate ? (
        <div className="reference-manager-actions">
          <button
            className="btn btn-secondary btn-sm"
            disabled={isRegenerating}
            type="button"
            onClick={() => void regenerateSameSettings()}
          >
            {isRegenerating ? "Regenerating..." : "Regenerate with Same Settings"}
          </button>
          <Link className="btn btn-ghost btn-sm" href={`/builder?regenerateCharacterId=${currentCharacter.id}`}>
            Regenerate from Settings Form
          </Link>
        </div>
      ) : null}

      {sortedPacks.length > 1 ? (
        <div className="reference-version-list" aria-label="Reference Candidates">
          {sortedPacks.map((pack) => {
            const thumbnail = pack.images.find((image) => image.kind === "reference-sheet") ?? pack.images[0];
            const asset = thumbnail ? assetsById.get(thumbnail.assetId) : undefined;
            const isActive = pack.id === activePack?.id;
            const isApplied = pack.id === currentCharacter.referencePackId;
            const isSelectingThisPack = selectingPackId === pack.id;

            return (
              <article
                className={`reference-version-card ${isActive ? "is-selected" : ""} ${isApplied ? "is-applied" : ""}`}
                key={pack.id}
              >
                <button
                  className="reference-version-preview"
                  type="button"
                  onClick={() => setPreviewPackId(pack.id)}
                >
                  <span className="reference-version-thumb">
                    {thumbnail ? (
                      <Image
                        alt={`${currentCharacter.name} v${pack.version}`}
                        height={asset?.height ?? 1200}
                        src={thumbnail.imageUrl}
                        width={asset?.width ?? 960}
                        unoptimized
                      />
                    ) : null}
                  </span>
                  <span className="reference-version-body">
                    <span className="reference-version-title">
                      v{pack.version}
                      {isApplied ? " / Applying" : ""}
                    </span>
                    <span className="reference-version-meta">
                      {pack.origin === "uploaded" ? "Uploaded" : "Generated"} / {formatDate(pack.createdAt)}
                    </span>
                  </span>
                </button>
                {isApplied ? (
                  <span className="chip chip-sage reference-version-status">Currently Applied</span>
                ) : (
                  <button
                    className="btn btn-primary btn-sm reference-version-apply"
                    disabled={Boolean(selectingPackId)}
                    type="button"
                    onClick={() => void selectReferencePack(pack.id)}
                  >
                    {isSelectingThisPack ? "Applying..." : "Apply This Candidate"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : null}

      {activePack ? (
        <div className="stack-md">
          {activePack.id !== currentCharacter.referencePackId ? (
            <div className="btn-row">
              <button
                className="btn btn-primary btn-sm"
                disabled={Boolean(selectingPackId)}
                type="button"
                onClick={() => void selectReferencePack(activePack.id)}
              >
                {selectingPackId === activePack.id ? "Applying..." : "Apply This Sheet"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-tertiary">This sheet is currently applied.</p>
          )}

          <div className="character-detail-reference-grid">
            {activePack.images.map((image) => {
              const asset = assetsById.get(image.assetId);
              return (
                <div className="character-detail-reference-card" key={image.id}>
                  <ZoomableImage
                    alt={`${currentCharacter.name} ${image.label}`}
                    height={asset?.height ?? 1200}
                    label={`${currentCharacter.name} / ${image.label}`}
                    sizes="(max-width: 900px) 100vw, 58vw"
                    src={image.imageUrl}
                    width={asset?.width ?? 960}
                  />
                  <p className="ref-card-label">{image.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p className="empty-state-title">No references yet</p>
          <Link className="btn btn-secondary" href="/builder">Create</Link>
        </div>
      )}
    </section>
  );
}
