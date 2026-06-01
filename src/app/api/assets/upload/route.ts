import { getCurrentActor, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { uploadAsset } from "@/lib/app-repository";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { UploadAssetInput } from "@/lib/types";
import { MAX_UPLOAD_BYTES } from "@/lib/validation";

const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + 512 * 1024;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_REQUEST_BYTES) {
      return Response.json({ message: "Upload body is too large." }, { status: 413 });
    }

    const actor = await getCurrentActor();
    if (!actor) return unauthorizedJson();

    const rateLimit = checkRateLimit({
      key: `asset-upload:${actor.id}`,
      limit: actor.isAnonymous ? 8 : 30,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const formData = await request.formData();
    const file = formData.get("file");
    const rawAnalysis = formData.get("analysis");

    if (!(file instanceof File)) {
      return Response.json(
        {
          message: "file is required",
          fieldErrors: [{ field: "file", message: "An image file is required." }],
        },
        { status: 400 },
      );
    }

    const input: UploadAssetInput | undefined =
      typeof rawAnalysis === "string" && rawAnalysis.trim()
        ? { analysis: JSON.parse(rawAnalysis) as UploadAssetInput["analysis"] }
        : undefined;

    const asset = await uploadAsset(actor.id, file, input);
    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
