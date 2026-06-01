import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { getAnonymousActorFromCookie, type AnonymousActor } from "@/lib/anonymous";
import { seedDefaultCharactersForUser } from "@/lib/app-repository";
import { readSignedSessionCookie } from "@/lib/session-cookie";
import { upsertSignedInUser } from "@/lib/user-repository";

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);
const localDevelopmentRuntime = process.env.NODE_ENV !== "production";
const localDevAuthEnabled =
  process.env.LOCAL_DEV_AUTH_ENABLED === "true" && localDevelopmentRuntime;
const localDevUserEmail = process.env.LOCAL_DEV_USER_EMAIL?.trim() || "local-dev@vchara.local";
const localDevUserName = process.env.LOCAL_DEV_USER_NAME?.trim() || "Local Dev";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: googleConfigured
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  callbacks: {
    async jwt({ token }) {
      if (!token.email) {
        return token;
      }

      const user = await upsertSignedInUser({
        email: token.email,
        name: token.name,
        image: token.picture,
      });
      token.userId = user.id;
      await seedDefaultCharactersForUser(user.id);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : token.sub ?? "";
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function isGoogleAuthConfigured() {
  return googleConfigured;
}

export function isLocalDevelopmentRuntime() {
  return localDevelopmentRuntime;
}

export function isLocalDevAuthEnabled() {
  return localDevAuthEnabled;
}

export function getLocalDevUserProfile() {
  return {
    email: localDevUserEmail,
    name: localDevUserName,
  };
}

export function isLocalDevUserEmail(email?: string | null) {
  return localDevAuthEnabled && email === localDevUserEmail;
}

export async function auth() {
  const signedSession = await readSignedSessionCookie();
  if (signedSession) {
    return {
      user: {
        id: signedSession.userId,
        name: signedSession.name ?? null,
        email: signedSession.email ?? null,
        image: signedSession.image ?? null,
      },
      expires: signedSession.expiresAt,
    };
  }

  return getServerSession(authOptions);
}

export async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return session.user;
}

export type CurrentActor =
  | {
      id: string;
      isAnonymous: false;
      name?: string | null;
      email?: string | null;
    }
  | AnonymousActor;

export async function getCurrentActor(): Promise<CurrentActor | undefined> {
  const session = await auth();

  if (session?.user?.id) {
    return {
      id: session.user.id,
      isAnonymous: false,
      name: session.user.name,
      email: session.user.email,
    };
  }

  return getAnonymousActorFromCookie();
}

export async function getRequiredApiUser() {
  const session = await auth();
  return session?.user?.id ? session.user : undefined;
}

export function unauthorizedJson() {
  return Response.json({ message: "Unauthorized" }, { status: 401 });
}
