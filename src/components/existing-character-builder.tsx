"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { defaultDraft } from "@/lib/catalog";
import { formatFileSize, prepareImageForUpload } from "@/lib/client-upload-image";
import type { Asset, CharacterDraftInput, CharacterSpec, ReferencePack } from "@/lib/types";

type PendingReferenceFile = {
  id: string;
  file: File;
  previewUrl: string;
  originalName: string;
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
  wasOptimized: boolean;
};

function createDraft(
  input: Pick<CharacterDraftInput, "name" | "tagline" | "story">,
) {
  return {
    ...defaultDraft,
    ...input,
  } satisfies CharacterDraftInput;
}

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    fieldErrors?: Array<{ message?: string }>;
  };

  return payload.fieldErrors?.[0]?.message || payload.message || "API request failed";
}

export function ExistingCharacterBuilder() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<PendingReferenceFile[]>([]);
  const appendRunIdRef = useRef(0);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [story, setStory] = useState("");
  const [files, setFiles] = useState<PendingReferenceFile[]>([]);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCharacter, setCreatedCharacter] = useState<CharacterSpec | null>(null);
  const [referencePack, setReferencePack] = useState<ReferencePack | null>(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  async function appendFiles(selectedFiles: FileList | null) {
    if (!selectedFiles?.length) return;

    const runId = appendRunIdRef.current + 1;
    appendRunIdRef.current = runId;
    setIsPreparingFiles(true);
    setError(null);

    try {
      const remaining = Math.max(0, 6 - filesRef.current.length);
      if (!remaining) return;

      const preparedFiles = await Promise.all(
        Array.from(selectedFiles)
          .slice(0, remaining)
          .map((file) => prepareImageForUpload(file)),
      );

      if (appendRunIdRef.current !== runId) {
        return;
      }

      setFiles((current) => [
        ...current,
        ...preparedFiles.map((item) => ({
          id: `${item.originalName}-${item.optimizedSize}-${Math.random().toString(36).slice(2, 8)}`,
          file: item.file,
          previewUrl: URL.createObjectURL(item.file),
          originalName: item.originalName,
          originalSize: item.originalSize,
          optimizedSize: item.optimizedSize,
          width: item.width,
          height: item.height,
          wasOptimized: item.wasOptimized,
        })),
      ]);
    } catch (caughtError) {
      if (appendRunIdRef.current === runId) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to compress the image.");
      }
    } finally {
      if (appendRunIdRef.current === runId) {
        setIsPreparingFiles(false);
      }
    }
  }

  function removeFile(fileId: string) {
    setFiles((current) => {
      const target = current.find((item) => item.id === fileId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return current.filter((item) => item.id !== fileId);
    });
  }

  async function uploadReferenceAssets() {
    const uploadedAssets: Asset[] = [];

    for (const item of files) {
      const formData = new FormData();
      formData.append("file", item.file);

      const response = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as { asset: Asset };
      uploadedAssets.push(payload.asset);
    }

    return uploadedAssets;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (files.length === 0) {
      setError("Add at least one reference image.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const uploadedAssets = await uploadReferenceAssets();
      const response = await fetch("/api/characters/existing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: createDraft({
            name,
            tagline,
            story,
          }),
          referenceAssetIds: uploadedAssets.map((asset) => asset.id),
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as {
        character: CharacterSpec;
        referencePack: ReferencePack;
      };
      setCreatedCharacter(payload.character);
      setReferencePack(payload.referencePack);

      startTransition(() => {
        router.push(`/builder/complete/${payload.character.id}`);
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to register the existing character.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="two-col">
      <form className="card card-padded" onSubmit={handleSubmit}>
        <div className="form-stack">
          <div className="card-section">
            <div className="builder-route-switch">
              <Link className="btn btn-secondary btn-sm" href="/builder">
                Create New with AI
              </Link>
              <span className="chip chip-sage">Import Existing Images</span>
            </div>
            <p className="text-sm text-secondary">
              Register reference sheets or character art you already have and use them directly in Studio.
            </p>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="existing-name">Character Name</label>
              <input
                required
                className="input"
                id="existing-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="existing-tagline">Tagline</label>
              <input
                className="input"
                id="existing-tagline"
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="existing-story">Character Notes</label>
            <textarea
              className="textarea textarea-compact"
              id="existing-story"
              value={story}
              onChange={(event) => setStory(event.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="field">
            <div className="field-row">
              <label className="field-label">Reference Images</label>
              <span className="field-hint">Up to 6 images</span>
            </div>
            <label className="upload-zone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V5" />
                <path d="M7.5 9.5L12 5l4.5 4.5" />
                <path d="M4 18.5h16" />
              </svg>
              <strong>Add reference sheets or character art</strong>
              <span>PNG, JPEG, or WebP. Images are resized to 1536px on the long edge before upload; PNG stays PNG, other formats are sent as WebP.</span>
              <input
                ref={inputRef}
                accept="image/png,image/jpeg,image/webp"
                disabled={isPreparingFiles}
                multiple
                type="file"
                onChange={(event) => {
                  void appendFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>

            {isPreparingFiles ? <p className="field-hint">Compressing images for upload...</p> : null}

            {files.length ? (
              <div className="reference-upload-grid">
                {files.map((item) => (
                  <div className="reference-upload-card" key={item.id}>
                    <div className="reference-upload-preview">
                      <Image alt={item.originalName} fill src={item.previewUrl} unoptimized />
                    </div>
                    <div className="reference-upload-meta">
                      <p className="reference-upload-name">{item.originalName}</p>
                      <p className="text-xs text-tertiary">
                        {item.wasOptimized
                          ? `${formatFileSize(item.originalSize)} → ${formatFileSize(item.optimizedSize)}`
                          : formatFileSize(item.optimizedSize)}
                      </p>
                      <p className="text-xs text-tertiary">
                        {item.width} × {item.height}{item.wasOptimized ? " / Compressed" : ""}
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => removeFile(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="btn-row">
            <button className="btn btn-primary" disabled={isSubmitting || isPreparingFiles} type="submit">
              {isPreparingFiles ? "Compressing images..." : isSubmitting ? "Registering..." : "Register Character from Existing Images"}
            </button>
            <button
              className="btn btn-secondary"
              disabled={isSubmitting || isPreparingFiles}
              type="button"
              onClick={() => {
                filesRef.current.forEach((item) => {
                  URL.revokeObjectURL(item.previewUrl);
                });
                setFiles([]);
                setName("");
                setTagline("");
                setStory("");
                setCreatedCharacter(null);
                setReferencePack(null);
                setError(null);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      <div className="stack-lg builder-side-column">
        <div className="side-panel">
          <h3 className="heading-md">Registration Preview</h3>
          <div className="chip-row">
            {name ? <span className="chip chip-soft">{name}</span> : null}
            {tagline ? <span className="chip chip-soft">{tagline}</span> : null}
            <span className="chip chip-sage">References {files.length} images</span>
            {files.some((item) => item.wasOptimized) ? <span className="chip chip-soft">Pre-upload Compression On</span> : null}
          </div>
          <p className="text-sm text-secondary">
            Registered images are saved as the default reference pack and can be used later in Studio.
          </p>
        </div>

        <div className="side-panel">
          <h3 className="heading-md">After Registration</h3>
          <div className="meta-list">
            <div className="meta-row"><span>1.</span><strong>Create a Reference Pack</strong></div>
            <div className="meta-row"><span>2.</span><strong>Show in Lists and Studio</strong></div>
            <div className="meta-row"><span>3.</span><strong>Add AI Variations if Needed</strong></div>
          </div>
          {createdCharacter && referencePack ? (
            <div className="chip-row" style={{ marginTop: 12 }}>
              <span className="chip chip-sage">{createdCharacter.name}</span>
              <span className="chip chip-soft">v{referencePack.version}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
