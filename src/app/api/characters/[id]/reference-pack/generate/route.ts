import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { generateReferencePackForCharacter } from "@/lib/app-repository";
import type { CharacterDraftInput } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredApiUser();
    if (!user) return unauthorizedJson();

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      regenerate?: boolean;
      draft?: CharacterDraftInput;
    };
    const payload = await generateReferencePackForCharacter(user.id, id, {
      regenerate: Boolean(body?.regenerate),
      draft: body?.draft,
    });
    return Response.json(payload, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return POST(request, { params });
}
