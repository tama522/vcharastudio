"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type {
  AlbumDeletionResult,
  AlbumItem,
  AlbumTrashResult,
  Asset,
  CharacterSpec,
  GenerationJob,
  SceneTemplate,
} from "@/lib/types";

interface AlbumGalleryProps {
  items: AlbumItem[];
  assets: Asset[];
  characters: CharacterSpec[];
  jobs: GenerationJob[];
  sceneTemplates: SceneTemplate[];
  initialCharacterId?: string;
}

type DeleteScope = "single" | "source";
type MutationMode = "trash" | "delete";
type MutationIntent = {
  menuId: string;
  itemId: string;
  scope: DeleteScope;
  mode: MutationMode;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function rootJobId(jobsById: Map<string, GenerationJob>, jobId: string) {
  let current = jobsById.get(jobId);
  while (current?.variationOfJobId) {
    current = jobsById.get(current.variationOfJobId);
  }
  return current?.id ?? jobId;
}

function albumGroupId(jobsById: Map<string, GenerationJob>, job: GenerationJob) {
  if (job.batchGroupId) {
    return `batch:${job.batchGroupId}`;
  }

  if (job.mode === "photo-composite" && !job.variationOfJobId) {
    const created = new Date(job.createdAt);
    if (Number.isFinite(created.getTime())) {
      const characterKey = [job.characterId, ...(job.characterIds ?? [])].filter(Boolean).join(",");
      return `legacy-batch:${characterKey}:${created.toISOString().slice(0, 19)}`;
    }
  }

  return `series:${rootJobId(jobsById, job.id)}`;
}

function backgroundLabel(job: GenerationJob, assetsById: Map<string, Asset>, templatesById: Map<string, SceneTemplate>) {
  if (job.mode === "scene-template") {
    return templatesById.get(job.sceneTemplateId ?? "")?.label ?? "Scene Template";
  }

  return assetsById.get(job.assetId ?? "")?.name ?? "Background Photo";
}

function mutationTitle(scope: DeleteScope, mode: MutationMode) {
  if (scope === "source") {
    return mode === "trash" ? "Move Source Background to Trash" : "Permanently Delete Source Background";
  }

  return mode === "trash" ? "Move Generated Image to Trash" : "Permanently Delete Generated Image";
}

function mutationDescription(scope: DeleteScope, mode: MutationMode) {
  if (scope === "source") {
    return mode === "trash"
      ? "Move this background photo and all variations in this chain to trash."
      : "Permanently delete this background photo and all variations in this chain. This cannot be undone.";
  }

  return mode === "trash"
    ? "Move only this generated image to trash."
    : "Permanently delete this generated image. This cannot be undone.";
}

function mutationButtonLabel(mode: MutationMode) {
  return mode === "trash" ? "Move to Trash" : "Delete Permanently";
}

function requiresConfirmStep(mode: MutationMode) {
  return mode === "delete";
}

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  return payload.message || "Request failed.";
}

function applySingleJobDeletion(current: GenerationJob[], deletedJobId: string) {
  const deletedJob = current.find((job) => job.id === deletedJobId);
  if (!deletedJob) {
    return current.filter((job) => job.id !== deletedJobId);
  }

  const directChildren = current
    .filter((job) => job.variationOfJobId === deletedJob.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (directChildren.length === 0) {
    return current.filter((job) => job.id !== deletedJobId);
  }

  const [promotedRoot, ...siblings] = directChildren;
  const siblingIds = new Set(siblings.map((job) => job.id));
  const updatedAt = new Date().toISOString();

  return current
    .filter((job) => job.id !== deletedJobId)
    .map((job) => {
      if (job.id === promotedRoot.id) {
        return {
          ...job,
          variationOfJobId: deletedJob.variationOfJobId,
          updatedAt,
        };
      }

      if (siblingIds.has(job.id)) {
        return {
          ...job,
          variationOfJobId: promotedRoot.id,
          updatedAt,
        };
      }

      return job;
    });
}

function applySingleJobTrash(current: GenerationJob[], trashedJobId: string, trashedAt: string) {
  const trashedJob = current.find((job) => job.id === trashedJobId);
  if (!trashedJob) {
    return current;
  }

  const directChildren = current
    .filter((job) => job.variationOfJobId === trashedJob.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (directChildren.length === 0) {
    return current.map((job) =>
      job.id === trashedJob.id
        ? {
            ...job,
            trashedAt,
            updatedAt: trashedAt,
          }
        : job,
    );
  }

  const [promotedRoot, ...siblings] = directChildren;
  const siblingIds = new Set(siblings.map((job) => job.id));

  return current.map((job) => {
    if (job.id === trashedJob.id) {
      return {
        ...job,
        trashedAt,
        updatedAt: trashedAt,
      };
    }

    if (job.id === promotedRoot.id) {
      return {
        ...job,
        variationOfJobId: trashedJob.variationOfJobId,
        updatedAt: trashedAt,
      };
    }

    if (siblingIds.has(job.id)) {
      return {
        ...job,
        variationOfJobId: promotedRoot.id,
        updatedAt: trashedAt,
      };
    }

    return job;
  });
}

function markAlbumItemsTrashed(current: AlbumItem[], targetIds: Set<string>, trashedAt: string) {
  return current.map((item) => (targetIds.has(item.id) ? { ...item, trashedAt } : item));
}

function markJobsTrashed(current: GenerationJob[], targetIds: Set<string>, trashedAt: string) {
  return current.map((job) =>
    targetIds.has(job.id)
      ? {
          ...job,
          trashedAt,
          updatedAt: trashedAt,
        }
      : job,
  );
}

function markAssetsTrashed(current: Asset[], targetIds: Set<string>, trashedAt: string) {
  return current.map((asset) => (targetIds.has(asset.id) ? { ...asset, trashedAt } : asset));
}

export function AlbumGallery({
  items,
  assets,
  characters,
  jobs,
  sceneTemplates,
  initialCharacterId,
}: AlbumGalleryProps) {
  const [albumItems, setAlbumItems] = useState(items);
  const [assetList, setAssetList] = useState(assets);
  const [jobList, setJobList] = useState(jobs);
  const [viewMode, setViewMode] = useState<"album" | "trash">("album");
  const [selectedCharacterId, setSelectedCharacterId] = useState(initialCharacterId ?? "all");
  const [selectedMode, setSelectedMode] = useState<"all" | GenerationJob["mode"]>("all");
  const [selectedBackground, setSelectedBackground] = useState("all");
  const [openDeleteMenuId, setOpenDeleteMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MutationIntent | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const deleteMenuRef = useRef<HTMLDivElement | null>(null);

  const isTrashView = viewMode === "trash";
  const jobsById = new Map(jobList.map((job) => [job.id, job]));
  const assetsById = new Map(assetList.map((asset) => [asset.id, asset]));
  const templatesById = new Map(sceneTemplates.map((template) => [template.id, template]));
  const charactersById = new Map(characters.map((character) => [character.id, character]));

  useEffect(() => {
    if (!openDeleteMenuId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (deleteMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpenDeleteMenuId(null);
      setConfirmDelete(null);
      setDeleteError(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setOpenDeleteMenuId(null);
      setConfirmDelete(null);
      setDeleteError(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openDeleteMenuId]);

  const visibleItems = albumItems.filter((item) => (isTrashView ? Boolean(item.trashedAt) : !item.trashedAt));

  const backgroundOptions = Array.from(
    new Set(
      visibleItems
        .map((item) => {
          const job = jobsById.get(item.generationJobId);
          return job ? backgroundLabel(job, assetsById, templatesById) : undefined;
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const filteredItems = visibleItems.filter((item) => {
    const job = jobsById.get(item.generationJobId);
    if (!job) return false;
    if (selectedCharacterId !== "all" && item.characterId !== selectedCharacterId) return false;
    if (selectedMode !== "all" && item.sourceMode !== selectedMode) return false;
    if (selectedBackground !== "all" && backgroundLabel(job, assetsById, templatesById) !== selectedBackground) return false;
    return true;
  });

  const groups = Array.from(
    filteredItems.reduce((map, item) => {
      const job = jobsById.get(item.generationJobId);
      if (!job) return map;
      const key = albumGroupId(jobsById, job);
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
      return map;
    }, new Map<string, AlbumItem[]>()),
  ).map(([groupId, groupItems]) => {
    const sortedItems = groupItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const groupJobs = sortedItems
      .map((item) => jobsById.get(item.generationJobId))
      .filter((job): job is GenerationJob => Boolean(job));
    const batchGroupId = groupJobs.find((job) => job.batchGroupId)?.batchGroupId;
    const isLegacyBatchGroup = groupId.startsWith("legacy-batch:") && sortedItems.length > 1;
    const isBatchGroup = Boolean(batchGroupId) || isLegacyBatchGroup;
    const rootJobIdForGroup = isBatchGroup ? undefined : groupId.startsWith("series:") ? groupId.replace(/^series:/, "") : sortedItems[0]?.generationJobId;
    const rootJob = rootJobIdForGroup ? jobsById.get(rootJobIdForGroup) : undefined;
    const representativeJob = rootJob ?? groupJobs[0];
    const parentJobId =
      isBatchGroup
        ? sortedItems.find((item) => !item.trashedAt)?.generationJobId ?? sortedItems[0]?.generationJobId
        : !rootJob?.trashedAt || isTrashView
          ? rootJobIdForGroup ?? sortedItems[0]?.generationJobId
          : sortedItems.find((item) => !item.trashedAt)?.generationJobId ?? rootJobIdForGroup;
    const sourceActionItem =
      !isBatchGroup && rootJob?.mode === "photo-composite" && rootJob.assetId
        ? sortedItems.find((item) => jobsById.get(item.generationJobId)?.assetId === rootJob.assetId) ?? sortedItems[0]
        : undefined;

    return {
      groupId,
      isBatchGroup,
      parentJobId,
      sourceActionItem,
      items: sortedItems,
      downloadHref:
        !isTrashView && sortedItems.length > 1
          ? `/api/album-items/download?ids=${sortedItems.map((item) => encodeURIComponent(item.id)).join(",")}`
          : undefined,
      title: isBatchGroup
        ? `${formatDate(sortedItems[sortedItems.length - 1]?.createdAt ?? sortedItems[0]?.createdAt ?? new Date().toISOString())}  Batch Generation`
        : representativeJob
          ? backgroundLabel(representativeJob, assetsById, templatesById)
          : "Series",
    };
  });

  async function toggleFavorite(itemId: string) {
    const response = await fetch(`/api/album-items/${itemId}/favorite`, { method: "POST" });
    if (!response.ok) return;
    const payload = (await response.json()) as { albumItem: AlbumItem };
    setAlbumItems((current) =>
      current.map((entry) => (entry.id === payload.albumItem.id ? payload.albumItem : entry)),
    );
  }

  async function handleMutation(item: AlbumItem, scope: DeleteScope, mode: MutationMode) {
    const targetJob = jobList.find((job) => job.id === item.generationJobId);
    setDeletingItemId(item.id);
    setDeleteError(null);

    try {
      const path =
        mode === "trash"
          ? scope === "single"
            ? `/api/album-items/${item.id}/trash`
            : `/api/album-items/${item.id}/source/trash`
          : scope === "single"
            ? `/api/album-items/${item.id}`
            : `/api/album-items/${item.id}/source`;
      const response = await fetch(path, { method: mode === "trash" ? "POST" : "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      if (mode === "trash") {
        const payload = (await response.json()) as AlbumTrashResult;
        const trashedAlbumItemIds = new Set(payload.trashedAlbumItemIds);
        const trashedJobIds = new Set(payload.trashedJobIds);
        const trashedAssetIds = new Set(payload.trashedAssetIds);

        setAlbumItems((current) => markAlbumItemsTrashed(current, trashedAlbumItemIds, payload.trashedAt));
        setJobList((current) => {
          if (scope === "single" && targetJob) {
            return applySingleJobTrash(current, targetJob.id, payload.trashedAt);
          }

          return markJobsTrashed(current, trashedJobIds, payload.trashedAt);
        });
        setAssetList((current) => markAssetsTrashed(current, trashedAssetIds, payload.trashedAt));
      } else {
        const payload = (await response.json()) as AlbumDeletionResult;
        const deletedAlbumItemIds = new Set(payload.deletedAlbumItemIds);
        const deletedJobIds = new Set(payload.deletedJobIds);
        const removedAssetIds = new Set(payload.removedAssetIds);

        setAlbumItems((current) => current.filter((entry) => !deletedAlbumItemIds.has(entry.id)));
        setJobList((current) => {
          if (scope === "single" && targetJob) {
            return applySingleJobDeletion(current, targetJob.id);
          }

          return current.filter((job) => !deletedJobIds.has(job.id));
        });
        setAssetList((current) => current.filter((asset) => !removedAssetIds.has(asset.id)));
      }

      setOpenDeleteMenuId(null);
      setConfirmDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Operation failed.");
    } finally {
      setDeletingItemId(null);
    }
  }

  return (
    <div className="stack-md">
      <div className="filter-stack">
        <div className="filter-chip-row">
          <button
            className={`chip chip-selectable ${!isTrashView ? "chip-selected" : ""}`}
            type="button"
            onClick={() => setViewMode("album")}
          >
            Album
          </button>
          <button
            className={`chip chip-selectable ${isTrashView ? "chip-selected" : ""}`}
            type="button"
            onClick={() => setViewMode("trash")}
          >
            Trash
          </button>
        </div>
        <div className="filter-bar">
          <select
            value={selectedCharacterId}
            onChange={(event) => setSelectedCharacterId(event.target.value)}
          >
            <option value="all">All Characters</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
          <span className="filter-bar-count">{filteredItems.length} items</span>
        </div>
        <div className="filter-chip-row">
          <button
            className={`chip chip-selectable ${selectedMode === "all" ? "chip-selected" : ""}`}
            type="button"
            onClick={() => setSelectedMode("all")}
          >
            All
          </button>
          <button
            className={`chip chip-selectable ${selectedMode === "scene-template" ? "chip-selected" : ""}`}
            type="button"
            onClick={() => setSelectedMode("scene-template")}
          >
            Scene Template
          </button>
          <button
            className={`chip chip-selectable ${selectedMode === "photo-composite" ? "chip-selected" : ""}`}
            type="button"
            onClick={() => setSelectedMode("photo-composite")}
          >
            Photo Composite
          </button>
        </div>
        <div className="filter-bar">
          <select
            value={selectedBackground}
            onChange={(event) => setSelectedBackground(event.target.value)}
          >
            <option value="all">All Backgrounds</option>
            {backgroundOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <span className="filter-bar-count">{groups.length}groups</span>
        </div>
      </div>

      {groups.length ? (
        <div className="album-series-list">
          {groups.map((group, groupIndex) => {
            const sourceActionItem = group.sourceActionItem;
            const groupMenuId = `group-${group.groupId}`;
            const groupMode: MutationMode = isTrashView ? "delete" : "trash";

            return (
              <section className="album-series" key={group.groupId}>
                <div className="series-header">
                  <div>
                    <p className="heading-md">{group.title}</p>
                    <p className="text-sm text-secondary">
                      {group.isBatchGroup ? `${group.items.length} image Batch Generation` : `${group.items.length} image Variation Chain`}
                    </p>
                  </div>
                  <div className="series-header-actions">
                    {group.downloadHref ? (
                      <a className="btn btn-secondary btn-sm" href={group.downloadHref}>
                        {group.items.length} images Download
                      </a>
                    ) : null}
                    {sourceActionItem ? (
                      <div
                        ref={openDeleteMenuId === groupMenuId ? deleteMenuRef : undefined}
                        className="series-header-delete"
                      >
                        <button
                          aria-expanded={openDeleteMenuId === groupMenuId}
                          aria-haspopup="dialog"
                          aria-label={mutationTitle("source", groupMode)}
                          className="btn-icon btn-icon-sm btn-icon-danger"
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setConfirmDelete(null);
                            setOpenDeleteMenuId((current) => (current === groupMenuId ? null : groupMenuId));
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4.8c0-.66.54-1.2 1.2-1.2h5.6c.66 0 1.2.54 1.2 1.2V6" />
                            <path d="M7 6l.8 12.2a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8L17 6" />
                            <path d="M10 10.5v5" />
                            <path d="M14 10.5v5" />
                          </svg>
                        </button>
                        {openDeleteMenuId === groupMenuId ? (
                          <div
                            className="album-card-menu album-card-menu-header"
                            role="dialog"
                            aria-label="Confirm Series Action"
                          >
                            <p className="album-card-menu-title">{mutationTitle("source", groupMode)}</p>
                            <p className="album-card-menu-text">{mutationDescription("source", groupMode)}</p>
                            {deleteError ? <p className="error-text">{deleteError}</p> : null}
                            {confirmDelete?.menuId === groupMenuId ? (
                              <div className="album-card-menu-actions">
                                <button
                                  className="btn btn-secondary btn-sm"
                                  disabled={deletingItemId === sourceActionItem.id}
                                  type="button"
                                  onClick={() => {
                                    setConfirmDelete(null);
                                    setDeleteError(null);
                                  }}
                                >
                                  Back
                                </button>
                                <button
                                  className="album-card-menu-confirm"
                                  disabled={deletingItemId === sourceActionItem.id}
                                  type="button"
                                  onClick={() => void handleMutation(sourceActionItem, "source", groupMode)}
                                >
                                  {deletingItemId === sourceActionItem.id
                                    ? groupMode === "trash"
                                      ? "Moving..."
                                      : "Deleting..."
                                    : mutationButtonLabel(groupMode)}
                                </button>
                              </div>
                            ) : (
                              <div className="album-card-menu-list">
                                <button
                                  className="album-card-menu-option album-card-menu-option-danger"
                                  disabled={deletingItemId === sourceActionItem.id}
                                  type="button"
                                  onClick={() => {
                                    if (!requiresConfirmStep(groupMode)) {
                                      void handleMutation(sourceActionItem, "source", groupMode);
                                      return;
                                    }

                                    setDeleteError(null);
                                    setConfirmDelete({
                                      menuId: groupMenuId,
                                      itemId: sourceActionItem.id,
                                      scope: "source",
                                      mode: groupMode,
                                    });
                                  }}
                                >
                                  {mutationButtonLabel(groupMode)}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {group.parentJobId ? (
                      <Link className="btn btn-secondary btn-sm" href={`/result/${group.parentJobId}`}>
                        {group.isBatchGroup ? "View Result" : "View Parent"}
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="album-grid">
                  {group.items.map((item, index) => {
                    const asset = assetsById.get(item.assetId);
                    const character = charactersById.get(item.characterId);
                    const job = jobsById.get(item.generationJobId);
                    const menuId = `item-${item.id}`;
                    const isDeleteMenuOpen = openDeleteMenuId === menuId;
                    const deleteIntent = confirmDelete?.menuId === menuId ? confirmDelete : null;
                    const isDeleting = deletingItemId === item.id;
                    const cardMode: MutationMode = isTrashView ? "delete" : "trash";

                    return (
                      <article
                        className="album-card"
                        key={item.id}
                        style={{
                          animationDelay: `${groupIndex * 40 + index * 30}ms`,
                          animation: "staggerIn 400ms var(--ease-out) backwards",
                        }}
                      >
                        <div
                          ref={isDeleteMenuOpen ? deleteMenuRef : undefined}
                          className="album-card-toolbar"
                        >
                          <button
                            aria-expanded={isDeleteMenuOpen}
                            aria-haspopup="dialog"
                            aria-label={mutationTitle("single", cardMode)}
                            className="btn-icon btn-icon-sm album-card-delete-trigger"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteError(null);
                              setConfirmDelete(null);
                              setOpenDeleteMenuId((current) => (current === menuId ? null : menuId));
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M8 6V4.8c0-.66.54-1.2 1.2-1.2h5.6c.66 0 1.2.54 1.2 1.2V6" />
                              <path d="M7 6l.8 12.2a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8L17 6" />
                              <path d="M10 10.5v5" />
                              <path d="M14 10.5v5" />
                            </svg>
                          </button>
                          {isDeleteMenuOpen ? (
                            <div
                              className="album-card-menu"
                              role="dialog"
                              aria-label="Confirm Delete"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <p className="album-card-menu-title">{mutationTitle("single", cardMode)}</p>
                              <p className="album-card-menu-text">{mutationDescription("single", cardMode)}</p>
                              {deleteError ? <p className="error-text">{deleteError}</p> : null}
                              {deleteIntent ? (
                                <div className="album-card-menu-actions">
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={isDeleting}
                                    type="button"
                                    onClick={() => {
                                      setConfirmDelete(null);
                                      setDeleteError(null);
                                    }}
                                  >
                                    Back
                                  </button>
                                  <button
                                    className="album-card-menu-confirm"
                                    disabled={isDeleting}
                                    type="button"
                                    onClick={() => void handleMutation(item, deleteIntent.scope, deleteIntent.mode)}
                                  >
                                    {isDeleting
                                      ? cardMode === "trash"
                                        ? "Moving..."
                                        : "Deleting..."
                                      : mutationButtonLabel(cardMode)}
                                  </button>
                                </div>
                              ) : (
                                <div className="album-card-menu-list">
                                  <button
                                    className={`album-card-menu-option ${cardMode === "delete" ? "album-card-menu-option-danger" : ""}`}
                                    disabled={isDeleting}
                                    type="button"
                                    onClick={() => {
                                      if (!requiresConfirmStep(cardMode)) {
                                        void handleMutation(item, "single", cardMode);
                                        return;
                                      }

                                      setDeleteError(null);
                                      setConfirmDelete({
                                        menuId,
                                        itemId: item.id,
                                        scope: "single",
                                        mode: cardMode,
                                      });
                                    }}
                                  >
                                    {mutationButtonLabel(cardMode)}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                        <Link className="album-card-link" href={`/result/${item.generationJobId}`}>
                          <div className="album-card-image">
                            {asset ? (
                              <Image
                                alt={item.title}
                                src={asset.imageUrl}
                                width={asset.width}
                                height={asset.height}
                                unoptimized
                              />
                            ) : null}
                          </div>
                        </Link>
                        <div className="album-card-info">
                          <div className="chip-row">
                            <span className="chip chip-soft">{job?.variationOfJobId ? "Variation" : "Parent"}</span>
                            <span className="chip chip-sage">{item.sourceMode === "scene-template" ? "Template" : "Photo"}</span>
                            {isTrashView ? <span className="chip chip-soft">Trash</span> : null}
                          </div>
                          <p className="album-card-title">{item.title}</p>
                          <div className="album-card-meta">
                            <span className="text-xs text-tertiary">
                              {character?.name} · {formatDate(isTrashView ? item.trashedAt ?? item.createdAt : item.createdAt)}
                            </span>
                            {isTrashView ? null : (
                              <button
                                className={`fav-btn ${item.favorite ? "is-active" : ""}`}
                                type="button"
                                onClick={() => void toggleFavorite(item.id)}
                              >
                                {item.favorite ? "★" : "☆"}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <p className="empty-state-title">{isTrashView ? "Trash is empty" : "No images match the filters"}</p>
          <p className="empty-state-text">
            {isTrashView ? "Images moved to trash will appear here." : "Reset the filters or create a new variation in Studio."}
          </p>
          {isTrashView ? null : <Link className="btn btn-primary" href="/studio">Open Studio</Link>}
        </div>
      )}
    </div>
  );
}
