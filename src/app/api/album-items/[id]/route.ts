import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { deleteAlbumItem } from "@/lib/app-repository";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredApiUser();
    if (!user) return unauthorizedJson();

    const { id } = await params;
    const result = await deleteAlbumItem(user.id, id);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
