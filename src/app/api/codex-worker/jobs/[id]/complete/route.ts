import { toErrorResponse } from "@/lib/api-errors";
import { completeUserCodexWorkerJob } from "@/lib/app-repository";
import { checkRateLimit, checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { authenticateCodexWorker } from "@/lib/user-codex-worker";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ipLimit = checkRequestRateLimit(request, "codex-worker-complete", {
      limit: 90,
      windowMs: 60 * 1000,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit);

    const worker = await authenticateCodexWorker(request);
    const workerLimit = checkRateLimit({
      key: `codex-worker-complete:${worker.id}`,
      limit: 45,
      windowMs: 60 * 1000,
    });
    if (!workerLimit.allowed) return rateLimitResponse(workerLimit);

    const [{ id }, body] = await Promise.all([
      params,
      request.json().catch(() => ({})),
    ]);
    const result = await completeUserCodexWorkerJob(
      worker.userId,
      worker.id,
      id,
      body && typeof body === "object" ? body : {},
    );

    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
