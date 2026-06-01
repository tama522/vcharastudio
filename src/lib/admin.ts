import "server-only";

import { redirect } from "next/navigation";
import { auth, isLocalDevUserEmail } from "@/lib/auth";

function parseCsvEnv(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function isAdminUser(user?: { id?: string | null; email?: string | null } | null) {
  if (!user) return false;

  const adminUserIds = parseCsvEnv(process.env.ADMIN_USER_IDS);
  const adminEmails = parseCsvEnv(process.env.ADMIN_EMAILS);

  return (
    (user.id ? adminUserIds.has(user.id) : false) ||
    (user.email ? adminEmails.has(user.email) || isLocalDevUserEmail(user.email) : false)
  );
}

export async function requireAdminUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  if (!isAdminUser(session.user)) {
    redirect("/");
  }

  return session.user;
}
