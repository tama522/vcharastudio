import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultActions } from "@/components/result-actions";
import { getCurrentActor } from "@/lib/auth";
import { CUSTOM_SCENE_TEMPLATE_ID, catalog, getOption, resolveGenerationFieldOption } from "@/lib/catalog";
import { getGenerationJob } from "@/lib/app-repository";
import type { GenerationJobPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildSuggestions(payload: GenerationJobPayload) {
  const characterCount = payload.job.characterIds?.length ?? 1;

  if (payload.job.mode === "photo-composite") {
    return [
      {
        title: "Change Placement",
        text: `${resolveGenerationFieldOption(payload.job, "placement").label}  to another placement can change the look even with the same background.`,
      },
      {
        title: "Try Foreground Occlusion",
        text: `${getOption(catalog.occlusionModes, payload.job.occlusionMode).label}  can change how the character blends into the background.`,
      },
      {
        title: "Create Size Variations",
        text: `Current ${payload.job.subjectScale}%. Try several versions around 90-110% to improve selection odds.`,
      },
      ...(characterCount > 1
        ? [{
            title: "Refine Character Balance",
            text: "For multi-character compositions, small placement and distance variations help avoid overlaps and cramped framing.",
          }]
        : []),
    ];
  }

  return [
    {
      title: "Change Composition",
      text: `${resolveGenerationFieldOption(payload.job, "placement").label} to another placement can change the look even with the same background.`,
    },
    {
      title: "Add Expression Variations",
      text: `${resolveGenerationFieldOption(payload.job, "expression").label}  plus other expressions can make the album stronger.`,
    },
    {
      title: "Change Aspect Ratio",
      text: `${getOption(catalog.aspectRatios, payload.job.aspectRatio).label}  plus other aspect ratios can cover social posts and wallpapers.`,
    },
  ];
}

function sceneTemplateSummary(payload: GenerationJobPayload) {
  if (payload.job.sceneTemplateId === CUSTOM_SCENE_TEMPLATE_ID) {
    return payload.job.sceneTemplateCustomText?.trim() || "Custom Text";
  }

  return payload.usedSceneTemplate?.label ?? "Scene Template";
}

function renderProviderLabel(provider: GenerationJobPayload["job"]["provider"]) {
  return provider === "user-codex" ? "User Codex" : null;
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const [{ jobId }, actor] = await Promise.all([params, getCurrentActor()]);
  if (!actor) {
    notFound();
  }

  const payload = await getGenerationJob(actor.id, jobId);

  if (!payload?.job) {
    notFound();
  }

  const suggestions = buildSuggestions(payload);
  const characters = payload.characters ?? (payload.character ? [payload.character] : []);
  const providerLabel = renderProviderLabel(payload.job.provider);

  return (
    <div className="page-content">
      <div className="page-title-block">
        <h1 className="heading-xl">
          {payload.job.status === "failed" ? "Generation Failed" : "Generation Complete"}
        </h1>
        <p className="page-subtitle">
          {payload.job.status === "failed"
            ? "Review the failure reason and reuse the settings."
            : "Review the result, then continue to variations or the next image."}
        </p>
        {providerLabel ? (
          <div className="chip-row">
            <span className="chip chip-soft">{providerLabel}</span>
          </div>
        ) : null}
      </div>

      <div className="two-col">
        <div className="stack-md">
          {payload.asset ? (
            <div className="result-image">
              <Image
                alt={payload.albumItem?.title ?? "Generated Result"}
                src={payload.asset.imageUrl}
                width={payload.asset.width}
                height={payload.asset.height}
                unoptimized
              />
            </div>
          ) : (
            <div className="empty-state result-empty-state">
              <div className="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5" />
                  <circle cx="12" cy="16.5" r="0.75" fill="currentColor" />
                </svg>
              </div>
              <p className="empty-state-title">No image was generated</p>
              <p className="empty-state-text">{payload.job.failureReason ?? "Review the settings and try again."}</p>
            </div>
          )}

          <ResultActions
            isSignedIn={!actor.isAnonymous}
            jobId={payload.job.id}
            characterId={payload.job.characterId}
            assetUrl={payload.asset?.imageUrl}
            temporaryReferenceAssetId={characters.length === 1 ? payload.asset?.id : undefined}
          />

          {payload.backgroundAsset ? (
            <div className="card card-padded">
              <h3 className="heading-md">Source Background</h3>
              <div className="stack-sm" style={{ marginTop: 10 }}>
                <div className="ref-card">
                  <Image
                    alt={payload.backgroundAsset.name}
                    src={payload.backgroundAsset.imageUrl}
                    width={payload.backgroundAsset.width}
                    height={payload.backgroundAsset.height}
                    unoptimized
                  />
                </div>
                <div className="meta-list">
                  <div className="meta-row"><span>File</span><strong>{payload.backgroundAsset.name}</strong></div>
                  <div className="meta-row"><span>Size</span><strong>{payload.backgroundAsset.width} × {payload.backgroundAsset.height}</strong></div>
                  <div className="meta-row"><span>Analysis</span><strong>{payload.backgroundAsset.sceneAnalysis?.summary ?? "Not analyzed"}</strong></div>
                </div>
              </div>
            </div>
          ) : null}

          {payload.referenceAssets?.length ? (
            <div className="card card-padded">
              <h3 className="heading-md">References Used</h3>
              <div className="ref-grid ref-grid-large" style={{ marginTop: 10 }}>
                {payload.referenceAssets.map((asset) => (
                  <div className="ref-card" key={asset.id}>
                    <Image alt={asset.name} src={asset.imageUrl} width={asset.width} height={asset.height} unoptimized />
                    <p className="ref-card-label">{asset.name}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="stack-lg">
          <div className="card card-padded">
            <h3 className="heading-md">Saved Info</h3>
            {characters.length ? (
              <div className="chip-row" style={{ marginTop: 10 }}>
                {characters.map((character, index) => (
                  <span className={`chip ${index === 0 ? "chip-sage" : "chip-soft"}`} key={character.id}>
                    {index === 0 ? `Lead: ${character.name}` : character.name}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="result-meta" style={{ marginTop: 8 }}>
              <div className="result-meta-row">
                <span className="result-meta-label">Date</span>
                <span className="result-meta-value">{formatDate(payload.job.updatedAt)}</span>
              </div>
              <div className="result-meta-row">
                <span className="result-meta-label">Characters</span>
                <span className="result-meta-value">{characters.length || 1} characters</span>
              </div>
              <div className="result-meta-row">
                <span className="result-meta-label">Mode</span>
                <span className="result-meta-value">
                  {payload.job.mode === "scene-template" ? "Scene Template" : "Photo Composite"}
                </span>
              </div>
              {providerLabel ? (
                <div className="result-meta-row">
                  <span className="result-meta-label">Provider</span>
                  <span className="result-meta-value">{providerLabel}</span>
                </div>
              ) : null}
              {payload.job.mode === "photo-composite" ? (
                <div className="result-meta-row">
                  <span className="result-meta-label">Preserve Background</span>
                  <span className="result-meta-value">{payload.job.preserveBackgroundPhoto ? "On" : "Off"}</span>
                </div>
              ) : null}
              <div className="result-meta-row">
                <span className="result-meta-label">Variation Chain</span>
                <span className="result-meta-value">{payload.job.variationOfJobId ? "Variation Job" : "Parent Job"}</span>
              </div>
              {payload.asset ? (
                <div className="result-meta-row">
                  <span className="result-meta-label">Output Size</span>
                  <span className="result-meta-value">{payload.asset.width} × {payload.asset.height}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card card-padded">
            <h3 className="heading-md">Settings Summary</h3>
            <div className="meta-list" style={{ marginTop: 10 }}>
              {payload.job.mode === "scene-template" ? (
                <div className="meta-row"><span>Scene Template</span><strong>{sceneTemplateSummary(payload)}</strong></div>
              ) : null}
              <div className="meta-row"><span>Body Posture</span><strong>{resolveGenerationFieldOption(payload.job, "bodyPosture").label}</strong></div>
              <div className="meta-row"><span>Pose</span><strong>{resolveGenerationFieldOption(payload.job, "pose").label}</strong></div>
              <div className="meta-row"><span>Expression</span><strong>{resolveGenerationFieldOption(payload.job, "expression").label}</strong></div>
              <div className="meta-row"><span>Framing</span><strong>{getOption(catalog.cameraDistances, payload.job.cameraDistance).label}</strong></div>
              <div className="meta-row"><span>Aspect Ratio</span><strong>{getOption(catalog.aspectRatios, payload.job.aspectRatio).label}</strong></div>
              <div className="meta-row"><span>Placement</span><strong>{resolveGenerationFieldOption(payload.job, "placement").label}</strong></div>
              <div className="meta-row"><span>Outfit</span><strong>{resolveGenerationFieldOption(payload.job, "outfitOverride").label}</strong></div>
              <div className="meta-row"><span>Character Style</span><strong>{resolveGenerationFieldOption(payload.job, "characterRenderStyle").label}</strong></div>
              {payload.job.mode === "photo-composite" ? (
                <>
                  <div className="meta-row"><span>Foreground</span><strong>{getOption(catalog.occlusionModes, payload.job.occlusionMode).label}</strong></div>
                  <div className="meta-row"><span>Background Style</span><strong>{payload.job.preserveBackgroundPhoto ? "Preserve Original Photo" : resolveGenerationFieldOption(payload.job, "backgroundRenderStyle").label}</strong></div>
                  <div className="meta-row"><span>Character Size</span><strong>{payload.job.subjectScale}%</strong></div>
                  <div className="meta-row"><span>Stylization</span><strong>{payload.job.styleStrength}%</strong></div>
                </>
              ) : null}
            </div>
          </div>

          {payload.job.failureReason ? (
            <div className="card card-padded">
              <h3 className="heading-md">Failure Reason</h3>
              <p className="error-text" style={{ marginTop: 10 }}>{payload.job.failureReason}</p>
            </div>
          ) : null}

          <div className="card card-padded">
            <h3 className="heading-md">Ideas to Try Next</h3>
            <div className="stack-sm" style={{ marginTop: 8 }}>
              {suggestions.map((idea) => (
                <div className="suggestion-card" key={idea.title}>
                  <h4>{idea.title}</h4>
                  <p>{idea.text}</p>
                </div>
              ))}
            </div>
            {payload.variationSource ? (
              <div className="card-divider" />
            ) : null}
            {payload.variationSource ? (
              <Link className="btn btn-secondary btn-sm" href={`/result/${payload.variationSource.id}`}>
                View Parent Job
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
