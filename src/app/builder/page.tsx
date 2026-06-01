import Link from "next/link";
import { CharacterBuilder } from "@/components/character-builder";
import { getCurrentActor } from "@/lib/auth";
import { draftFromCharacter } from "@/lib/character-draft";
import { listCharacters } from "@/lib/app-repository";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ regenerateCharacterId?: string }>;
}) {
  const actor = await getCurrentActor();
  const { regenerateCharacterId } = await searchParams;
  const characters = actor ? await listCharacters(actor.id) : [];
  const regenerateCharacter = regenerateCharacterId
    ? characters.find((character) => character.id === regenerateCharacterId)
    : undefined;

  return (
    <div className="page-content">
      <div className="page-title-block">
        <h1 className="heading-xl">
          {regenerateCharacter ? "Regenerate Character References" : "Create a Character with AI"}
        </h1>
        <p className="page-subtitle">
          {regenerateCharacter
            ? `Adjust the current settings for ${regenerateCharacter.name} and create a new candidate sheet.`
            : "Choose only the details you need, from age and mood to outfit and color palette."}
        </p>
        <div className="builder-route-switch">
          <span className="chip chip-soft">AI Builder</span>
          {regenerateCharacter ? (
            <Link className="btn btn-secondary btn-sm" href={`/characters/${regenerateCharacter.id}`}>
              Back to Details
            </Link>
          ) : (
            <Link className="btn btn-secondary btn-sm" href="/builder/existing">
              Import Existing Images
            </Link>
          )}
        </div>
      </div>
      <CharacterBuilder
        initialCount={characters.length}
        initialDraft={regenerateCharacter ? draftFromCharacter(regenerateCharacter) : undefined}
        isSignedIn={Boolean(actor && !actor.isAnonymous)}
        regenerateCharacterId={regenerateCharacter?.id}
      />
    </div>
  );
}
