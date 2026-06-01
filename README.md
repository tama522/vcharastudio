# VcharaStudio

VcharaStudio is a Cloudflare-oriented Next.js app for creating original character references, generating compositions, and saving generated assets per user.

The public version is intentionally configured as a template. It does not include private environment files, runtime image data, Cloudflare account IDs, production secrets, or a hosted public demo.

Image generation is designed around a user-owned local Codex worker. This repository does not include a hosted image-generation backend or a shared OpenAI API key flow.

## Features

- Character builder with structured character specs
- Existing-character registration from uploaded references
- Generation studio with pose, expression, framing, outfit, and background controls
- Album with favorites, trash, source-group deletion, and ZIP download
- Google OAuth sign-in with per-user data isolation
- Cloudflare D1 for app data
- Cloudflare R2 for uploaded and generated assets
- User-owned local Codex worker bridge for image generation jobs
- Admin usage dashboard gated by `ADMIN_EMAILS` or `ADMIN_USER_IDS`

## Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS v4
- NextAuth.js
- OpenNext for Cloudflare
- Cloudflare Workers, D1, and R2

## Requirements

- Node.js 20 or newer
- pnpm
- Cloudflare account for D1/R2/Workers deployment
- Google OAuth client for sign-in

## Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm exec wrangler d1 migrations apply VCHARA_DB --local --config wrangler.jsonc
pnpm dev
```

Open `http://localhost:3000`.

For local-only testing without Google OAuth, set `LOCAL_DEV_AUTH_ENABLED=true` in `.env.local`. Do not enable local development sign-in in production.

Generated images require a local Codex worker connected from the Codex Worker Setup screen. The app can be explored without that worker, but generation jobs will not complete until a worker is running.

## Environment

Create `.env.local` from `.env.example`.

```bash
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-string"
AUTH_SECRET="replace-with-a-long-random-string"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
LOCAL_DEV_AUTH_ENABLED="false"
LOCAL_DEV_USER_EMAIL="local-dev@vchara.local"
LOCAL_DEV_USER_NAME="Local Dev"
LOCAL_DEV_ALLOWED_ORIGINS="localhost,127.0.0.1,192.168.*.*,10.*.*.*"
IMAGE_PROVIDER="user-codex"
ADMIN_EMAILS=""
ADMIN_USER_IDS=""
CODEX_WORKER_TOKEN_TTL_DAYS="30"
```

## Cloudflare Setup

1. Create a D1 database.
2. Create an R2 bucket.
3. Copy `wrangler.jsonc` and replace the placeholder D1 database ID, bucket name, worker URL, and service name.
4. Set Worker secrets:

```bash
pnpm exec wrangler secret put NEXTAUTH_SECRET
pnpm exec wrangler secret put AUTH_SECRET
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
```

5. Apply remote D1 migrations:

```bash
pnpm exec wrangler d1 migrations apply VCHARA_DB --remote --config wrangler.jsonc
```

6. Build or deploy:

```bash
pnpm cf:build
pnpm cf:deploy
```

## Scripts

- `pnpm dev` - embed the Codex worker script and start Next dev
- `pnpm build` - embed the Codex worker script and build Next.js
- `pnpm lint` - run ESLint
- `pnpm cf:build` - build for Cloudflare with OpenNext
- `pnpm cf:preview` - preview the Cloudflare build locally
- `pnpm cf:deploy` - deploy through OpenNext Cloudflare

## Public Snapshot Notes

This repository is the open-source template edition. It intentionally removes:

- Hosted public demo deployment
- Private deployment notes
- Production domains and Cloudflare account IDs
- Generated runtime images
- Local build output
- Project-specific landing page assets
- Private default character art

The included default character uses a placeholder SVG. Replace it with your own artwork before publishing a branded deployment.

The sample studio control sprites in `public/studio/` are AI-generated placeholder assets created without reference images. Replace them if your project needs a distinct visual identity or different asset licensing.

## Architecture Notes

- App data is stored in Cloudflare D1.
- Uploaded and generated images are stored in Cloudflare R2.
- D1 migrations live in `migrations/`. The public template does not use Prisma.
- Google OAuth is handled by NextAuth.js.
- Image generation jobs are designed to be pulled by a user-owned Codex worker bridge.
- The admin usage dashboard is available only to users listed in `ADMIN_EMAILS` or `ADMIN_USER_IDS`.

## Codex Worker Bridge

The app can create a per-user worker token from the Codex connection screen. The generated command starts a local worker process that polls for pending generation jobs and uploads completed results back to the app.

This is a local-owner workflow, not a hosted generation service. Each deployment owner is responsible for running and securing their own worker process.

Treat the worker token like an API key. It can access the owning user's queued jobs and source assets.

## Security Notes

- Do not commit `.env*`, `.dev.vars`, `.wrangler`, `.open-next`, generated assets, or local D1/R2 data.
- Rotate any real credentials before publishing a fork or deployment.
- The Codex worker token can access the owning user's queued generation jobs and source assets. Treat it like an API key.
- Uploaded and generated assets should be served only through authenticated routes.

## License

MIT
