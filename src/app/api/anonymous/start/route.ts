import { redirect } from "next/navigation";
import { ensureAnonymousActor } from "@/lib/anonymous";
import { seedDefaultCharactersForUser } from "@/lib/app-repository";

function safeNextPath(request: Request) {
  const value = new URL(request.url).searchParams.get("next") || "/studio";
  if (!value.startsWith("/") || value.startsWith("//")) return "/studio";
  return value;
}

export async function GET(request: Request) {
  const actor = await ensureAnonymousActor();
  await seedDefaultCharactersForUser(actor.id);
  redirect(safeNextPath(request));
}
