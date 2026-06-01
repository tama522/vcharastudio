# Roadmap

VcharaStudio is an early public template. The roadmap focuses on making the project easier to run, adapt, and maintain as an open-source Cloudflare app.

## Near Term

- Add more setup screenshots and short walkthroughs for the local development flow.
- Improve first-run guidance for Cloudflare D1, R2, and Google OAuth setup.
- Add focused tests around user-owned assets, album ownership, and Codex worker token flows.
- Document common deployment mistakes and recovery steps.

## Contribution Areas

- Setup docs and troubleshooting notes
- Cloudflare deployment examples
- UI polish for the character builder and generation studio
- Security review around authenticated asset delivery
- Tests for repository and route-handler behavior

## Maintainer Notes

The project does not provide a hosted image-generation backend. Each deployment owner runs their own local Codex worker and controls their own Cloudflare resources.
