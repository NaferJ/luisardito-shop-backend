# Copilot custom instructions — luisardito-shop-backend

GitHub Copilot reads this file as repo-wide custom instructions across editors
(VS Code + JetBrains). Follow these rules on every suggestion and commit message
in this repository. Keep this file in sync with `AGENTS.md` and
`.windsurf/rules.md` — they encode the same house rules for different tools.

## What this project is

**Node.js 20** REST API for the Luisardito gamified points and rewards system.
**Express 5.1**, **Sequelize 6.37** ORM over **MySQL 8.0** (mysql2 driver),
**Redis 7** cache (ioredis), **TypeScript** (CommonJS, `tsx` at runtime),
**Jest** tests. Integrates **Kick** (OAuth 2.0, chat bot via `ws`/`axios`,
webhooks) and **Discord** (`discord.js` 14), with **Cloudinary** image storage,
**node-cron** scheduled tasks, **pdfkit** PDF generation, and **bcryptjs**
password hashing. Containerized with Docker Compose (`db`, `redis`, `api`).

This is the backend half of the Luisardito site. The frontend
(`luisardito-shop-frontend`) consumes this API read-only. API response-shape
changes here are consumer-visible and must be coordinated with the frontend.

## Code conventions

- **English only** in code, comments, logs, identifiers, and commit messages. No
  Spanish in those.
- No emojis anywhere in code, logs, comments, commit messages, or docs.
- **TypeScript, but `strict: false`** (see `tsconfig.json`). Do not introduce
  `any` where a precise type is reasonable, and do not add non-null `!` just to
  silence the compiler. Prefer accurate types; narrow with guards when needed.
- Use the **`@/*` → `src/*`** path alias for imports, not long relative paths.
- Small, single-purpose modules. Keep **controllers thin** (parse request,
  call a service, shape the response); put business logic in `src/services/*`,
  data access in `src/models/*`, request validation in `src/schemas/*` /
  `src/middleware/*`.
- Use the shared **`src/utils/logger`** for logging. `console.log` is an ESLint
  error (`no-console: error`) everywhere except the logger module itself.
  `console.warn` / `console.error` are also discouraged — use the logger.
  **Never log secrets** (tokens, passwords, JWTs, OAuth secrets, webhook
  signatures).
- Use **Conventional Commits**, in English (see `.github/git-commit-instructions.md`).
- Never touch the sibling repos (`luisardito-shop-frontend`, `poxyram-backend`)
  from here — separate projects.

## Backend conventions

- **Express 5.1** (not Express 4). Route handlers are async; the codebase uses
  an async-handler wrapper — follow the existing pattern in
  `src/controllers/*` rather than hand-rolling try/catch in every handler.
- **Sequelize 6.37** models live in `src/models/*` and use the
  `class X extends Model<InferAttributes<X>, InferCreationAttributes<X>>`
  pattern with `export = X` (CommonJS). The Sequelize CLI config is
  `.sequelizerc`; migrations live in `/migrations`, seeders in `/seeders`.
  Models are registered and associated in `src/models/index.ts`.
- **Migrations are mandatory for schema changes.** Never run `sync({ alter })`
  in production. Every migration must have a reversible `down`. Migration
  filenames use the `YYYYMMDDHHMMSS-kebab-name.js` convention.
- **Validation**: request bodies are validated with **Zod** schemas
  (`src/schemas/*`) before reaching controllers. Add/extend a Zod schema when
  adding an endpoint or input field.
- **Auth**: JWT (`jsonwebtoken`) for the shop users; OAuth 2.0 with Kick and
  Discord. Auth/authorization middleware lives in `src/middleware/*`. Token
  refresh logic lives in `src/services/tokenRefresh.service.ts` /
  `tokenService.ts`.
- **Scheduled tasks** (`node-cron`) and bot services live in `src/services/*`
  (files named `*.task.ts` for cron jobs, `*.service.ts` for logic).
- **Config** is env-driven via `config.ts`. `.env.example` is the single source
  of truth for env var documentation. Do not read `process.env.*` ad-hoc in
  services — go through `config.ts` so defaults and types are centralized.

## Environment

- `.env.example` is the single source of truth for env var documentation.
  Real secrets live in `.env`, `.env.development`, `.env.development.local`
  (all gitignored). Never commit real secrets.
- Keep `.gitignore` excluding `node_modules`, `.env*` (except the example),
  `dist`, `tokens/`, `backups/`, `logs/`.

## Testing & local gates

- Tests run on **Jest** (`npm test`, `npm run test:watch`). Tests live in
  `tests/`. When adding/changing behavior, add or update tests.
- Before a PR, all available gates must pass:
  `npm run format:check` · `npm run lint` · `npm run typecheck` · `npm run build` · `npm test`.
- **Do NOT run `npm run dev`** — the user runs the dev server themselves.
- **Do NOT commit or push** — only the user does that. Make the change, run the
  verification gates, and report the diff plus command output without committing.

## Scope discipline

- Make only the change requested for the current step. Do not refactor
  unrelated files.
- If a task is ambiguous, state your assumption before proceeding.
- API response-shape changes are consumer-visible. If you add/remove/rename a
  field, document it in the PR and flag any frontend impact.

## Pull requests

- PR descriptions MUST follow the repo template at
  `.github/pull_request_template.md`
  (Issue / What / Why / Scope-Non-goals / API-schema-impact / Verification /
  Rollback).
- PR titles and descriptions MUST always be written in Markdown format.
- Keep PRs small and single-concern.
