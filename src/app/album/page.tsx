import { AlbumGallery } from "@/components/album-gallery";
import { requireUser } from "@/lib/auth";
import {
  listAlbumItems,
  listAssets,
  listCharacters,
  listGenerationJobs,
  listSceneTemplates,
} from "@/lib/app-repository";

export const dynamic = "force-dynamic";

export default async function AlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ characterId?: string }>;
}) {
  const user = await requireUser();
  const [params, items, assets, characters, jobs, sceneTemplates] = await Promise.all([
    searchParams,
    listAlbumItems(user.id),
    listAssets(user.id),
    listCharacters(user.id),
    listGenerationJobs(user.id),
    listSceneTemplates(),
  ]);

  return (
    <div className="page-content">
      <div className="page-title-block">
        <h1 className="heading-xl">Album</h1>
        <p className="page-subtitle">Compare batches and variation chains, then keep the images you want to use.</p>
      </div>
      <AlbumGallery
        items={items}
        assets={assets}
        characters={characters}
        jobs={jobs}
        sceneTemplates={sceneTemplates}
        initialCharacterId={params.characterId}
      />
    </div>
  );
}
