import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { trashAlbumItem } from "@/lib/app-repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredApiUser();
    if (!user) return unauthorizedJson();

    const { id } = await params;
    const result = await trashAlbumItem(user.id, id);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
