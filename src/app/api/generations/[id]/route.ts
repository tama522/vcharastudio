import { getCurrentActor, unauthorizedJson } from "@/lib/auth";
import { getGenerationJob } from "@/lib/app-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentActor();
  if (!actor) return unauthorizedJson();

  const { id } = await params;
  const payload = await getGenerationJob(actor.id, id);

  if (!payload) {
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  return Response.json(payload);
}
