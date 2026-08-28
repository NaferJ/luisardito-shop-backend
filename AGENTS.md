# Luisardito Backend

Node.js 20 REST API for the Luisardito gamified points and rewards system. Express 5.1, Sequelize 6.37 ORM over MySQL 8.0, Redis 7 cache (ioredis), TypeScript (CommonJS, tsx runtime), Jest tests. Integrates Kick (OAuth 2.0, chat bot, webhooks) and Discord (discord.js 14), with Cloudinary image storage, node-cron scheduled tasks, pdfkit PDF generation, and bcryptjs password hashing. Containerized with Docker Compose.

See `.github/copilot-instructions.md` for full code conventions and rules.

## Commands

- `npm run dev` — dev server with hot reload (the user runs this; AI should not)
- `npm run build` — TypeScript compile to `dist/` (`tsc -p tsconfig.build.json`)
- `npm run start` — run from source with `tsx app.ts`
- `npm run start:prod` — serve the compiled build (`node dist/app.js`)
- `npm run lint` — ESLint
- `npm run lint:fix` — ESLint with `--fix`
- `npm run format` / `npm run format:check` — Prettier
- `npm run typecheck` — `tsc --noEmit`
- `npm test` / `npm run test:watch` — Jest
- `npm run migrate` / `migrate:status` / `migrate:undo` / `migrate:undo:all` — Sequelize migrations
- `npm run seed` / `seed:undo` — Sequelize seeders
- `npm run setup-db` — `migrate` then `seed`
- `npm run reset-db` — undo all migrations, then `setup-db`
- `npm run dev:setup` — start the `db` container, then migrate and seed
- `npm run dev:reset` — tear down containers/volumes, recreate `db`, then migrate and seed
- `npm run docker:dev` / `docker:dev:down` / `docker:dev:logs` — full Docker Compose dev stack
- `npm ci` — install dependencies **exactly as locked** (use this locally instead of `npm install`)

### Windows / cross-platform lock file note

CI runs on `ubuntu-latest`. Some dependencies have platform-specific optional dependencies. **`npm install` on Windows silently drops the Linux-only optional dependency entries from `package-lock.json`**, which then breaks `npm ci` in CI with `Missing: ... from lock file` errors.

Rules to avoid this:

1. **Never run plain `npm install` on Windows** after the lock file is correct — it rewrites the lock and strips Linux entries. Use `npm ci` for routine local installs instead; it only reads the lock, never rewrites it.
2. **When adding/updating a dependency**, regenerate the lock file in a Linux container so both platforms' optional deps are recorded:
   ```powershell
   docker run --rm -v "${PWD}:/app" -w /app node:22 sh -c "npm install --no-audit --no-fund"
   ```
   Then run `npm ci` locally (Windows) to install from the corrected lock without touching it again.
3. Verify before pushing: `docker run --rm -v "${PWD}:/app" -w /app node:22 sh -c "rm -rf node_modules && npm ci"` should succeed with no errors — this exactly mirrors CI.

## Environment

`.env.example` is the single source of truth for env var documentation. Real secrets live in `.env`, `.env.development`, `.env.development.local` (all gitignored). Config is centralized in `config.ts` — read env vars through it, not `process.env` ad-hoc. Key vars:

- `PORT` — server port (default `3000`)
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DB_SSL` — MySQL connection
- `JWT_SECRET` — JWT signing secret
- `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` / `KICK_REDIRECT_URI` — Kick OAuth
- `KICK_BROADCASTER_ID` — main streamer Kick ID
- `KICK_OAUTH_*` / `KICK_API_BASE_URL` — Kick API endpoints
- Cloudinary, Discord, and Redis vars are documented in `.env.example` / `.env.cloudinary-example`

On the production VPS, the CD workflow writes the production `.env` from GitHub secrets (see `.github/workflows/prod-cd.yml`).

## Frontend dependency

This backend is consumed by the `luisardito-shop-frontend` API (read-only). API response-shape changes are consumer-visible: if you add, remove, or rename a response field, document it in the PR and flag any frontend impact. If a data-shape mismatch is found on the frontend, it is a backend bug and must be fixed here, not worked around silently in the frontend.

## Docker Compose

The base `docker-compose.yml` defines three services:

- **db** — MySQL 8.0 with a persistent volume and a health check.
- **redis** — Redis 7-alpine with a persistent volume and a health check.
- **api** — The Node.js application built from the Dockerfile, depending on `db` and `redis` being healthy.

Development overrides live in `docker-compose.override.yml` (hot reload, published ports, development env) and production overrides in `docker-compose.prod.yml` (production env file, restart policy, host port mapping). Compose applies the override file automatically in development; production deploys pass both files explicitly.

## CI/CD

- **CI (`ci.yml`)** — Triggers on pushes to `dev` and PRs to `dev` or `main`. Runs `npm ci`, `npm test`, and a `docker build`. It does **not** run ESLint or Prettier — run `npm run format:check` and `npm run lint` locally before pushing.
- **Production CD (`prod-cd.yml`)** — Triggers on pushes to `main`. Writes the production `.env` on the VPS from GitHub secrets and deploys the stack with `docker compose`.

## Project Board

The backlog is tracked on the GitHub Projects board: https://github.com/users/NaferJ/projects/13

### Fields

- **Status** — Todo / In Progress / In Review / Done
- **Priority** — High / Medium / Low

Sprint and category are tracked via labels (`feature`, `tooling`, etc.) instead of board fields.

### Workflow

Cards move through the following statuses:

1. **Todo** — Issue created and added to the board, not yet started.
2. **In Progress** — Actively being coded (branch checked out, work underway).
3. **In Review** — PR is open and awaiting review/merge.
4. **Done** — PR merged. PRs that include `Closes #NN` in their description auto-close the referenced issue and move the board card to Done.

### gh CLI commands

Common operations for working with the board:

- View the board:
  `gh project item-list 13 --owner NaferJ`
- Create an issue:
  `gh issue create --repo NaferJ/luisardito-shop-backend --title "..." --body "..."`
- Add an issue to the board:
  `gh project item-add 13 --owner NaferJ --url <issue-url>`

### Labels

Apply labels to every issue to categorize work. The repo has 13 labels total:

**Custom labels (apply to every issue):**

- `feature` — New feature or API endpoint
- `ops` — Operations, infra, CI/CD, deployment
- `content` — Content, copy, or asset task (no code changes)
- `tooling` — Developer tooling, workflow, config, monitoring

**GitHub default labels (use when applicable):**

- `bug` — Something isn't working
- `documentation` — Improvements or additions to documentation
- `enhancement` — New feature or request (use `feature` instead for API work)
- `good first issue` — Good for newcomers
- `help wanted` — Extra attention is needed
- `question` — Further information is requested
- `duplicate` — This issue or pull request already exists
- `invalid` — This doesn't seem right
- `wontfix` — This will not be worked on

### Milestones

Milestones group issues and PRs toward a **release version** (e.g. "v1.1.0"). They are NOT the same as sprints:

- **Sprint** = time box ("what am I working on this cycle")
- **Milestone** = release target ("what version does this ship in")

**Only create a milestone when shipping a version with consumer-visible changes.** Tooling/ops/internal sprints get NO milestone. A milestone is created when you know which issues will ship in the next version bump; when all issues in the milestone are closed, the version is ready to release.

### Card movement rule

When working on an issue, the AI must:

1. Move the card to **In Progress** when starting work (and tell the user)
2. Move the card to **In Review** when a PR is opened (and tell the user)
3. The card moves to **Done** automatically when the PR with `Closes #NN` merges

Always tell the user when moving a card between statuses.

### Assignment rule

**Every issue must be assigned to NaferJ.** When creating an issue, always pass `--add-assignee NaferJ`. The board is a solo project — there are no unassigned cards.

### Status updates

Status updates are high-level project health reports (not task-level updates). Add one via the project board UI (side panel -> Add update).

**When to add a status update:**

- A sprint starts ("Sprint 1 started, target Sep 14")
- A sprint ends ("Sprint 1 complete, 5/6 items done")
- The project is at risk ("Blocked on Kick API change, sprint delayed")
- A major milestone ships ("v1.1.0 released with leaderboard subscription tiers + webhook hardening")

**Cadence for solo work:** one update at sprint start + one at sprint end. Not every session.

Each update has: Status (On track / At risk / Off track), start date, target date, and a brief Markdown message.

### Issue templates

Issue templates exist in `.github/ISSUE_TEMPLATE/`:

- `feature.md` — feature requests (endpoints, services, models, migrations)
- `content.md` — content, copy, or asset tasks
- `tooling.md` — tooling and infrastructure tasks

Use these templates when creating new issues to keep descriptions consistent.
