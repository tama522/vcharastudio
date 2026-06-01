import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { duplicateDefaultTemplateCharacter } from "@/lib/app-repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredApiUser();
    if (!user) return unauthorizedJson();

    const { id } = await params;
    const payload = await duplicateDefaultTemplateCharacter(user.id, id);
    return Response.json(payload, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
