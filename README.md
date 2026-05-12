# fuckubitch

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPLv3-blue" alt="License">
  <img src="https://img.shields.io/badge/stack-Vue%203%20%7C%20Hono%20%7C%20D1-black" alt="Stack">
  <img src="https://img.shields.io/badge/status-dev-yellow" alt="Status">
</p>

最权威的中文 benchmark

## Quick Start

```bash
pnpm setup   # install deps + init db
pnpm dev     # start worker + vite
```

## Deploy

```bash
cp wrangler.toml.example wrangler.toml   # fill in your D1 ID + secrets
pnpm db:migrate --remote && pnpm db:seed --remote
pnpm deploy
pnpm pages:build && npx wrangler pages deploy src/pages/dist
```

## Stack

Vue 3 / Vite / Pinia / UnoCSS — Hono / Cloudflare Workers / D1 — GitHub & Google OAuth

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/challenges` | - |
| GET | `/api/challenges/daily` | - |
| GET | `/api/challenges/:slug` | - |
| GET | `/api/challenges/:slug/submissions` | - |
| POST | `/api/challenges/:slug/submit` | ✓ |
| GET | `/api/leaderboard` | - |
| GET | `/api/users/me` | ✓ |
| GET | `/api/users/me/history` | ✓ |
| GET | `/api/auth/github/start` | - |
| GET | `/api/auth/google/start` | - |

## License

AGPLv3
