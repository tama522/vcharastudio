import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { createCharacter, listCharacters } from "@/lib/app-repository";
import type { CharacterDraftInput } from "@/lib/types";

export async function GET() {
  const user = await getRequiredApiUser();
  if (!user) return unauthorizedJson();

  return Response.json({ characters: await listCharacters(user.id) });
}

export async function POST(request: Request) {
  try {
    const user = await getRequiredApiUser();
    if (!user) return unauthorizedJson();

    const body = (await request.json()) as CharacterDraftInput;
    const payload = await createCharacter(user.id, body);

    return Response.json(payload, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
