import { getCurrentActor, unauthorizedJson } from "@/lib/auth";
import { getAssetContent } from "@/lib/app-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentActor();
  if (!actor) return unauthorizedJson();

  const { id } = await params;
  const payload = await getAssetContent(actor.id, id);

  if (!payload) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(payload.buffer, {
    status: 200,
    headers: {
      "Content-Type": payload.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
