"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";

const baseNavItems = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z" />
      </svg>
    ),
  },
  {
    href: "/builder",
    label: "Builder",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.8 5.4L19.2 10l-5.4 1.8L12 17.2l-1.8-5.4L4.8 10l5.4-1.8L12 3z" />
        <path d="M19 16l.8 2.4L22.2 19.2l-2.4.8L19 22.4l-.8-2.4L15.8 19.2l2.4-.8L19 16z" />
      </svg>
    ),
  },
  {
    href: "/studio",
    label: "Studio",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    href: "/album",
    label: "Album",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

const activePathMatchers: Record<string, (pathname: string) => boolean> = {
  "/": (pathname) => pathname === "/",
  "/builder": (pathname) => pathname === "/builder" || pathname.startsWith("/builder/"),
  "/studio": (pathname) => pathname === "/studio" || pathname.startsWith("/studio/") || pathname.startsWith("/result/"),
  "/album": (pathname) => pathname === "/album" || pathname.startsWith("/album/"),
  "/codex-worker": (pathname) => pathname === "/codex-worker",
  "/admin/usage": (pathname) => pathname === "/admin/usage" || pathname.startsWith("/admin/usage/"),
};

export function AppShell({
  children,
  isAdmin = false,
  showCodexWorkerNav = false,
  user,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
  showCodexWorkerNav?: boolean;
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
}) {
  const pathname = usePathname();
  const isSignedIn = Boolean(user);
  const isSignInPage = pathname === "/sign-in";
  const userEmail = user?.email?.trim() || null;
  const userDisplayName =
    user?.name?.trim() || (userEmail ? userEmail.split("@")[0] : "Signed in");
  const navItems = [
    ...baseNavItems,
    ...(showCodexWorkerNav
      ? [
          {
            href: "/codex-worker",
            label: "Codex",
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 8h10" />
                <path d="M7 12h6" />
                <path d="M8 18l-4 3V5a2 2 0 012-2h12a2 2 0 012 2v11a2 2 0 01-2 2H8z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            href: "/admin/usage",
            label: "Admin",
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
                <path d="M8 4v16" />
              </svg>
            ),
          },
        ]
      : []),
  ];

  function isActive(href: string) {
    return activePathMatchers[href]?.(pathname) ?? false;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="app-logo" href="/">
          Vchara<span>Studio</span>
        </Link>
        <div className="app-header-right">
          {isSignedIn ? (
            <>
              <nav className="desktop-nav" aria-label="Main navigation">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    className={`desktop-nav-link ${isActive(item.href) ? "is-active" : ""}`}
                    href={item.href}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="app-user">
                <span className="app-user-badge" title={userEmail ?? userDisplayName}>
                  {userDisplayName}
                </span>
                <div className="app-user-copy">
                  <strong>{userDisplayName}</strong>
                  <span>{userEmail || "Signed in with Google"}</span>
                </div>
                <SignOutButton />
              </div>
            </>
          ) : (
            <div className="app-user">
              {isSignInPage ? <span className="chip chip-soft">Google Sign-In</span> : null}
              <GoogleSignInButton />
            </div>
          )}
        </div>
      </header>

      <main className="app-main">{children}</main>

      {isSignedIn ? (
        <nav className="bottom-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={`bottom-nav-item ${isActive(item.href) ? "is-active" : ""}`}
              href={item.href}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
