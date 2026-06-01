import { toErrorResponse } from "@/lib/api-errors";
import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createUserCodexWorker, listUserCodexWorkers } from "@/lib/user-codex-worker";

export async function GET() {
  try {
    const user = await getRequiredApiUser();
    if (!user?.id) return unauthorizedJson();

    const workers = await listUserCodexWorkers(user.id);
    return Response.json({ workers });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRequiredApiUser();
    if (!user?.id) return unauthorizedJson();

    const rateLimit = checkRateLimit({
      key: `codex-worker-token:create:${user.id}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const body = (await request.json().catch(() => ({}))) as { name?: unknown };
    const result = await createUserCodexWorker(user.id, { name: body.name });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
