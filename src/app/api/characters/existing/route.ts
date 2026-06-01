import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { createCharacterFromExistingAssets } from "@/lib/app-repository";
import type { ExistingCharacterRegistrationInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const user = await getRequiredApiUser();
    if (!user) return unauthorizedJson();

    const body = (await request.json()) as ExistingCharacterRegistrationInput;
    const payload = await createCharacterFromExistingAssets(user.id, body);

    return Response.json(payload, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
