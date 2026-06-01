import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { isAdminUser } from "@/lib/admin";
import { auth } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "VcharaStudio",
  description: "A web app template for character references and background compositing.",
  applicationName: "VcharaStudio",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const admin = isAdminUser(session?.user);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell
          isAdmin={admin}
          showCodexWorkerNav
          user={session?.user}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
