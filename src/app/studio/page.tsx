import { redirect } from "next/navigation";
import { GenerationStudio } from "@/components/generation-studio";
import { getCurrentActor } from "@/lib/auth";
import { getGenerationJob, listAssets, listCharacters, listReferencePacks, listSceneTemplates } from "@/lib/app-repository";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{
    characterId?: string;
    jobId?: string;
    inheritMode?: string;
    temporaryReferenceAssetId?: string;
    temporaryReferenceCharacterId?: string;
  }>;
}) {
  const [params, actor] = await Promise.all([searchParams, getCurrentActor()]);
  if (!actor) {
    redirect("/api/anonymous/start?next=/studio");
  }

  const initialJobMode = params.inheritMode === "edit" ? "edit" : "variation";
  const [characters, referencePacks, templates, initialJobPayload, temporaryReferenceAsset] = await Promise.all([
    actor ? listCharacters(actor.id) : Promise.resolve([]),
    actor ? listReferencePacks(actor.id) : Promise.resolve([]),
    listSceneTemplates(),
    actor && params.jobId ? getGenerationJob(actor.id, params.jobId) : Promise.resolve(undefined),
    params.temporaryReferenceAssetId
      ? actor
        ? listAssets(actor.id).then((assets) => assets.find((asset) => asset.id === params.temporaryReferenceAssetId))
        : Promise.resolve(undefined)
      : Promise.resolve(undefined),
  ]);

  return (
    <div className="page-content">
      <div className="page-title-block">
        <h1 className="heading-xl">Studio</h1>
        <p className="page-subtitle">Tune the background and references together to produce a natural final image.</p>
      </div>
      <GenerationStudio
        characters={characters}
        isAnonymous={Boolean(actor?.isAnonymous)}
        isSignedIn={Boolean(actor && !actor.isAnonymous)}
        referencePacks={referencePacks}
        sceneTemplates={templates}
        initialCharacterId={params.characterId}
        initialJobPayload={initialJobPayload}
        initialJobMode={initialJobMode}
        initialTemporaryReferenceAssetId={params.temporaryReferenceAssetId}
        initialTemporaryReferenceAsset={temporaryReferenceAsset}
        initialTemporaryReferenceCharacterId={params.temporaryReferenceCharacterId}
      />
    </div>
  );
}
