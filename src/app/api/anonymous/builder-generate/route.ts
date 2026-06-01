import { auth } from "@/lib/auth";
import { ensureAnonymousActor, reserveAnonymousGeneration } from "@/lib/anonymous";
import { toErrorResponse } from "@/lib/api-errors";
import { createCharacter, generateReferencePackForCharacter } from "@/lib/app-repository";
import { checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { CharacterDraftInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const ipLimit = checkRequestRateLimit(request, "anonymous-builder-generate", {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit);

    const session = await auth();
    if (session?.user?.id) {
      return Response.json({ message: "Signed-in users should use the normal builder API." }, { status: 400 });
    }

    const actor = await ensureAnonymousActor();
    await reserveAnonymousGeneration(actor.id, "builder");

    const body = (await request.json()) as CharacterDraftInput;
    const created = await createCharacter(actor.id, body);
    const generated = await generateReferencePackForCharacter(actor.id, created.character.id);

    return Response.json({
      character: created.character,
      referencePack: generated.referencePack,
    }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
