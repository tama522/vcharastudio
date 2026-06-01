import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { selectReferencePackForCharacter } from "@/lib/app-repository";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredApiUser();
    if (!user) return unauthorizedJson();

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { referencePackId?: string };
    const payload = await selectReferencePackForCharacter(user.id, id, body.referencePackId ?? "");
    return Response.json(payload, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
