import { toErrorResponse } from "@/lib/api-errors";
import { getRequiredApiUser, unauthorizedJson } from "@/lib/auth";
import { revokeUserCodexWorker } from "@/lib/user-codex-worker";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredApiUser();
    if (!user?.id) return unauthorizedJson();

    const { id } = await params;
    await revokeUserCodexWorker(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
