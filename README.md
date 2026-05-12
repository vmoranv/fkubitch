# fuckubitch

<p align="center">
  <img src="https://img.shields.io/badge/Vue_3-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue 3">
  <img src="https://img.shields.io/badge/Hono-E36002?style=flat-square&logo=hono&logoColor=white" alt="Hono">
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflareworkers&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/D1-Cloudflare?style=flat-square&logo=sqlite&logoColor=white&color=F38020" alt="D1">
  <img src="https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black" alt="Drizzle ORM">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Pinia-FFD859?style=flat-square" alt="Pinia">
  <img src="https://img.shields.io/badge/UnoCSS-333333?style=flat-square&logo=unocss&logoColor=white" alt="UnoCSS">
</p>

中文断句 benchmark — 人类 vs LLM，看谁断句断得准。

## Quick Start

```bash
pnpm setup   # install deps + init db
pnpm dev     # wrangler dev (8787) + vite dev (5173)
```

## Deploy

```bash
cp wrangler.toml.example wrangler.toml   # fill D1 ID + secrets
pnpm db:init:remote
pnpm deploy
pnpm pages:build && npx wrangler pages deploy src/pages/dist
```

## API

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/challenges` | | List challenges |
| GET | `/api/challenges/daily` | | Today's challenge |
| GET | `/api/challenges/:slug` | | Single challenge |
| POST | `/api/challenges/submit` | ✓ | Submit new challenge |
| GET | `/api/challenges/:slug/submissions` | | Top submissions |
| POST | `/api/challenges/:slug/submit` | ✓ | Submit answer |
| GET | `/api/leaderboard` | | Human leaderboard |
| GET | `/api/leaderboard/models` | | LLM leaderboard |
| GET | `/api/users/me` | ✓ | Profile + rank |
| GET | `/api/users/me/history` | ✓ | Submission history |
| POST | `/api/auth/github/start` | | GitHub OAuth |
| POST | `/api/auth/google/start` | | Google OAuth |
