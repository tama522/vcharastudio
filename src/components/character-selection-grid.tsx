"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ZoomableImage } from "@/components/zoomable-image";
import { characterSummaryRows, formatCharacterSummaryValue } from "@/lib/character-summary";
import type { CharacterSpec, ReferencePack } from "@/lib/types";

interface CharacterSelectionGridProps {
  characters: CharacterSpec[];
  referencePacks: ReferencePack[];
}

type Entry = {
  character: CharacterSpec;
  referencePack: ReferencePack;
};

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    fieldErrors?: Array<{ message?: string }>;
  };

  return payload.fieldErrors?.[0]?.message || payload.message || "API request failed";
}

export function CharacterSelectionGrid({
  characters,
  referencePacks,
}: CharacterSelectionGridProps) {
  const router = useRouter();
  const [characterList, setCharacterList] = useState(characters);
  const [referencePackList, setReferencePackList] = useState(referencePacks);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingTagline, setEditingTagline] = useState("");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCharacterId, setExpandedCharacterId] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      characterList
        .map((character) => ({
          character,
          referencePack: referencePackList
            .filter((item) => item.characterId === character.id)
            .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))[0],
        }))
        .filter((entry): entry is Entry => Boolean(entry.referencePack)),
    [characterList, referencePackList],
  );

  function startEditing(character: CharacterSpec) {
    setEditingCharacterId(character.id);
    setEditingName(character.name);
    setEditingTagline(character.tagline);
    setError(null);
  }

  function cancelEditing() {
    setEditingCharacterId(null);
    setEditingName("");
    setEditingTagline("");
  }

  async function saveCharacter(characterId: string) {
    setPendingActionId(characterId);
    setError(null);

    try {
      const response = await fetch(`/api/characters/${characterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingName,
          tagline: editingTagline,
        }),
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
      cancelEditing();
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to update the character.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function removeCharacter(entry: Entry) {
    const confirmed = window.confirm(`"${entry.character.name}" will be deleted. Related references, generation history, and album items will also be deleted.`);
    if (!confirmed) return;

    setPendingActionId(entry.character.id);
    setError(null);

    try {
      const response = await fetch(`/api/characters/${entry.character.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setCharacterList((current) => current.filter((character) => character.id !== entry.character.id));
      setReferencePackList((current) => current.filter((pack) => pack.characterId !== entry.character.id));
      if (editingCharacterId === entry.character.id) {
        cancelEditing();
      }
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to delete the character.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function duplicateCharacter(entry: Entry) {
    setPendingActionId(entry.character.id);
    setError(null);

    try {
      const response = await fetch(`/api/characters/${entry.character.id}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as {
        character: CharacterSpec;
        referencePack: ReferencePack;
      };

      setCharacterList((current) => [payload.character, ...current]);
      setReferencePackList((current) => [payload.referencePack, ...current]);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to duplicate the character.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function clearConsistencyReferences(entry: Entry) {
    const confirmed = window.confirm(`"${entry.character.name}": clear all adopted consistency references?`);
    if (!confirmed) return;

    setPendingActionId(entry.character.id);
    setError(null);

    try {
      const response = await fetch(`/api/characters/${entry.character.id}/consistency-references`, {
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
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to clear consistency references.");
    } finally {
      setPendingActionId(null);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.8 5.4L19.2 10l-5.4 1.8L12 17.2l-1.8-5.4L4.8 10l5.4-1.8L12 3z" />
          </svg>
        </div>
        <p className="empty-state-title">Create a Character</p>
        <p className="empty-state-text">Use the builder to assemble your own original character.</p>
        <div className="btn-row">
          <Link className="btn btn-primary" href="/builder">
            Create with AI
          </Link>
          <Link className="btn btn-secondary" href="/builder/existing">
            Import Existing Images
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="character-grid">
        {entries.map((entry, index) => {
          const { character, referencePack } = entry;
          const isEditing = editingCharacterId === character.id;
          const isPending = pendingActionId === character.id;
          const isDefaultTemplate = character.isDefaultTemplate;
          const isExpanded = expandedCharacterId === character.id;
          const detailRows = characterSummaryRows(character)
            .map((row) => ({ ...row, formattedValue: formatCharacterSummaryValue(row.value) }))
            .filter((row) => row.formattedValue);
          const primaryImage =
            referencePack.images.find((image) => image.kind === "reference-sheet") ??
            referencePack.images.find((image) => image.kind === "full-body") ??
            referencePack.images[0];

          return (
            <article
              className="character-card"
              key={character.id}
              role="link"
              tabIndex={0}
              style={{ animationDelay: `${index * 60}ms`, animation: "staggerIn 400ms var(--ease-out) backwards" }}
              onClick={() => router.push(`/characters/${character.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  router.push(`/characters/${character.id}`);
                }
              }}
            >
              <div className="character-card-images">
                {primaryImage ? (
                  <div className="character-card-img">
                    <ZoomableImage
                      alt={`${character.name} Reference`}
                      buttonOnly
                      height={1200}
                      imageHref={`/characters/${character.id}`}
                      label={`${character.name} / Reference`}
                      sizes="(max-width: 640px) 100vw, 30vw"
                      src={primaryImage.imageUrl}
                      width={960}
                    />
                  </div>
                ) : null}
              </div>

              <div className="character-card-info">
                <div className="character-card-header">
                  <div className="character-card-header-main">
                    {isEditing ? (
                      <div className="character-card-edit-fields">
                        <input
                          className="input input-compact"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          placeholder="Character Name"
                        />
                        <input
                          className="input input-compact"
                          value={editingTagline}
                          onChange={(event) => setEditingTagline(event.target.value)}
                          placeholder="Tagline"
                        />
                      </div>
                    ) : (
                      <div>
                        <h3 className="character-card-name">{character.name}</h3>
                        {character.tagline ? (
                          <p className="character-card-tagline">{character.tagline}</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="character-card-header-side">
                    <span className="character-card-badge">
                      {isDefaultTemplate
                        ? "default template"
                        : character.source === "existing-assets"
                          ? `v${referencePack.version} / upload`
                          : `v${referencePack.version} / sheet`}
                    </span>
                    <div className="character-card-toolbar" onClick={(event) => event.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <button
                            aria-label="Save"
                            className="btn-icon btn-icon-sm"
                            disabled={isPending}
                            title={isPending ? "Saving" : "Save"}
                            type="button"
                            onClick={() => void saveCharacter(character.id)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </button>
                          <button
                            aria-label="Cancel"
                            className="btn-icon btn-icon-sm"
                            disabled={isPending}
                            title="Cancel"
                            type="button"
                            onClick={cancelEditing}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : isDefaultTemplate ? null : (
                        <>
                          <button
                            aria-label="Edit Name"
                            className="btn-icon btn-icon-sm"
                            disabled={isPending}
                            title="Edit Name"
                            type="button"
                            onClick={() => startEditing(character)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                            </svg>
                          </button>
                          <button
                            aria-label="Delete"
                            className="btn-icon btn-icon-danger btn-icon-sm"
                            disabled={isPending}
                            title={isPending ? "Deleting" : "Delete"}
                            type="button"
                            onClick={() => void removeCharacter(entry)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <dl className="character-card-specs">
                  {character.source === "existing-assets" ? (
                    <>
                      <div className="character-card-spec">
                        <dt>Source</dt>
                        <dd>{isDefaultTemplate ? "Shared Template" : "Existing Images"}</dd>
                      </div>
                      <div className="character-card-spec">
                        <dt>References</dt>
                        <dd>{referencePack.images.length} images</dd>
                      </div>
                      <div className="character-card-spec">
                        <dt>Status</dt>
                        <dd>{isDefaultTemplate ? "Locked Template" : "Registered"}</dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="character-card-spec">
                        <dt>Hairstyle</dt>
                        <dd>{character.parts.hairStyleLabel}</dd>
                      </div>
                      <div className="character-card-spec">
                        <dt>Outfit</dt>
                        <dd>{character.parts.outfitLabel}</dd>
                      </div>
                      <div className="character-card-spec">
                        <dt>Color Palette</dt>
                        <dd>{character.parts.colorwayLabel}</dd>
                      </div>
                    </>
                  )}
                </dl>

                <div className="character-card-reference-row" onClick={(event) => event.stopPropagation()}>
                  <span className="chip chip-soft">
                    Consistency References {character.consistencyAssetIds.length}  items
                  </span>
                  {character.consistencyAssetIds.length > 0 ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={isPending}
                      type="button"
                      onClick={() => void clearConsistencyReferences(entry)}
                    >
                      Clear Consistency References
                    </button>
                  ) : null}
                </div>

                {detailRows.length ? (
                  <div className="character-card-detail" onClick={(event) => event.stopPropagation()}>
                    <button
                      aria-expanded={isExpanded}
                      className="detail-toggle character-card-detail-toggle"
                      type="button"
                      onClick={() => setExpandedCharacterId(isExpanded ? null : character.id)}
                    >
                      <span className="detail-toggle-text">Creation Settings</span>
                      <span className="detail-toggle-icon" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </button>
                    {isExpanded ? (
                      <dl className="character-card-detail-list">
                        {detailRows.map((row) => (
                          <div className="character-card-detail-row" key={row.label}>
                            <dt>{row.label}</dt>
                            <dd>{row.formattedValue}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                ) : null}

                <div className="character-card-actions" onClick={(event) => event.stopPropagation()}>
                  <Link className="btn btn-secondary btn-sm" href={`/characters/${character.id}`}>
                    Details
                  </Link>
                  <Link className="btn btn-primary btn-sm" href={`/studio?characterId=${character.id}`}>
                    Generate
                  </Link>
                  <Link className="btn btn-secondary btn-sm" href={`/album?characterId=${character.id}`}>
                    Album
                  </Link>
                  {isDefaultTemplate ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={isPending}
                      type="button"
                      onClick={() => void duplicateCharacter(entry)}
                    >
                      {isPending ? "Duplicating..." : "Duplicate and Edit"}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
