import { reserveAnonymousGeneration } from "@/lib/anonymous";
import { getCurrentActor, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { createGenerationJob } from "@/lib/app-repository";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { GenerationRequestInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const actor = await getCurrentActor();
    if (!actor) return unauthorizedJson();

    const rateLimit = checkRateLimit({
      key: `generation:create:${actor.id}`,
      limit: actor.isAnonymous ? 6 : 30,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const body = (await request.json()) as GenerationRequestInput;
    if (actor.isAnonymous) {
      await reserveAnonymousGeneration(actor.id, "studio");
    }

    const created = await createGenerationJob(actor.id, body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
