# Contributing

Thanks for your interest in VcharaStudio.

## Development

```bash
pnpm install
cp .env.example .env.local
pnpm exec wrangler d1 migrations apply VCHARA_DB --local --config wrangler.jsonc
pnpm dev
```

Before opening a pull request, run:

```bash
pnpm lint
pnpm build
```

For Cloudflare runtime changes, also run:

```bash
pnpm cf:build
```

## Guidelines

- Keep secrets and runtime data out of Git.
- Prefer small, focused changes.
- Update documentation when behavior, setup, deployment, or security assumptions change.
- Keep user data isolation and asset authorization intact.

