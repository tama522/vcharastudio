import Link from "next/link";
import { CharacterSelectionGrid } from "@/components/character-selection-grid";
import { auth } from "@/lib/auth";
import {
  listAlbumItems,
  listCharacters,
  listGenerationJobs,
  listReferencePacks,
} from "@/lib/app-repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="page-content">
        <div className="page-title-block">
          <span className="chip chip-sage">Open source template</span>
          <h1 className="heading-xl">VcharaStudio</h1>
          <p className="page-subtitle">
            This public edition is an app template. Bring your own Cloudflare resources, Google OAuth app, and character assets.
          </p>
        </div>

        <div className="quick-actions">
          <Link className="quick-action" href="/sign-in">
            <div className="quick-action-icon quick-action-icon-sage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
            </div>
            <div className="quick-action-text">
              <span className="quick-action-label">Sign In</span>
              <span className="quick-action-desc">Use your Google OAuth setup</span>
            </div>
          </Link>
          <Link className="quick-action" href="/api/anonymous/start?next=/studio">
            <div className="quick-action-icon quick-action-icon-coral">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div className="quick-action-text">
              <span className="quick-action-label">Try Sample</span>
              <span className="quick-action-desc">Start with the placeholder character</span>
            </div>
          </Link>
          <Link className="quick-action" href="/codex-worker">
            <div className="quick-action-icon quick-action-icon-sky">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 8h10" />
                <path d="M7 12h6" />
                <path d="M8 18l-4 3V5a2 2 0 012-2h12a2 2 0 012 2v11a2 2 0 01-2 2H8z" />
              </svg>
            </div>
            <div className="quick-action-text">
              <span className="quick-action-label">Codex Setup</span>
              <span className="quick-action-desc">Connect a generation worker</span>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  const user = session.user;
  const [characters, jobs, albumItems, referencePacks] = await Promise.all([
    listCharacters(user.id),
    listGenerationJobs(user.id),
    listAlbumItems(user.id),
    listReferencePacks(user.id),
  ]);

  const hasCharacters = characters.length > 0;

  return (
    <div className="page-content">
      {/* Quick Actions */}
      <div className="quick-actions">
        <Link className="quick-action" href="/builder">
          <div className="quick-action-icon quick-action-icon-coral">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div className="quick-action-text">
            <span className="quick-action-label">Create Character</span>
            <span className="quick-action-desc">Build a new character</span>
          </div>
        </Link>
        <Link className="quick-action" href="/builder/existing">
          <div className="quick-action-icon quick-action-icon-sky">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="M21 15l-4.5-4.5L8 19" />
            </svg>
          </div>
          <div className="quick-action-text">
            <span className="quick-action-label">Import Character</span>
            <span className="quick-action-desc">Register from your own images</span>
          </div>
        </Link>
        <Link className="quick-action" href="/studio">
          <div className="quick-action-icon quick-action-icon-sage">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <div className="quick-action-text">
            <span className="quick-action-label">Generate Image</span>
            <span className="quick-action-desc">Composite into a background</span>
          </div>
        </Link>
        <Link className="quick-action" href="/codex-worker">
          <div className="quick-action-icon quick-action-icon-sky">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 8h10" />
              <path d="M7 12h6" />
              <path d="M8 18l-4 3V5a2 2 0 012-2h12a2 2 0 012 2v11a2 2 0 01-2 2H8z" />
            </svg>
          </div>
          <div className="quick-action-text">
            <span className="quick-action-label">Codex Setup</span>
            <span className="quick-action-desc">View your connection instructions</span>
          </div>
        </Link>
      </div>

      {/* Stats */}
      {hasCharacters ? (
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-value">{characters.length}</span>
            <span className="stat-label">Characters</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{jobs.length}</span>
            <span className="stat-label">Generations</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{albumItems.length}</span>
            <span className="stat-label">Album</span>
          </div>
        </div>
      ) : null}

      {/* Character Grid */}
      <div className="page-title-block">
        <div className="page-title-row">
          <h2 className="heading-lg">Characters</h2>
          <Link className="btn btn-secondary btn-sm" href="/builder/existing">
            Import Existing
          </Link>
        </div>
        {hasCharacters ? (
          <p className="page-subtitle">Open a character to view details.</p>
        ) : null}
      </div>

      <CharacterSelectionGrid characters={characters} referencePacks={referencePacks} />
    </div>
  );
}
