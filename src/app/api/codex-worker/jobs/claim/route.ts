import { toErrorResponse } from "@/lib/api-errors";
import { claimUserCodexWorkerJob } from "@/lib/app-repository";
import { checkRateLimit, checkRequestRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { authenticateCodexWorker } from "@/lib/user-codex-worker";

export async function POST(request: Request) {
  try {
    const ipLimit = checkRequestRateLimit(request, "codex-worker-claim", {
      limit: 180,
      windowMs: 60 * 1000,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit);

    const worker = await authenticateCodexWorker(request);
    const workerLimit = checkRateLimit({
      key: `codex-worker-claim:${worker.id}`,
      limit: 90,
      windowMs: 60 * 1000,
    });
    if (!workerLimit.allowed) return rateLimitResponse(workerLimit);

    const job = await claimUserCodexWorkerJob(worker.userId, worker.id);

    return Response.json({
      job: job ?? null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
