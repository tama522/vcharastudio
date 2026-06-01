import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { toggleAlbumFavorite } from "@/lib/app-repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredApiUser();
    if (!user) return unauthorizedJson();

    const { id } = await params;
    const albumItem = await toggleAlbumFavorite(user.id, id);
    return Response.json({ albumItem });
  } catch (error) {
    return toErrorResponse(error);
  }
}
