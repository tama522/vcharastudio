import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { claimAnonymousDataForSignedInUser } from "@/lib/anonymous";

function safeNextPath(request: Request) {
  const value = new URL(request.url).searchParams.get("next") || "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: Request) {
  const session = await auth();
  const nextPath = safeNextPath(request);

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/api/anonymous/claim?next=${nextPath}`)}`);
  }

  await claimAnonymousDataForSignedInUser(session.user.id, nextPath);
}
