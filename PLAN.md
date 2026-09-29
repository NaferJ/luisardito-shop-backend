# PLAN — Comunidad + housekeeping sprint

Living document for multi-session work. Any session (human or agent) must be able to resume from this file alone.
Update checkboxes and the Session Log as work completes. Keep it short — decisions and state, not history.

**Repos involved**

- Backend: `luisardito-shop-backend` (this repo) — board https://github.com/users/NaferJ/projects/13
- Frontend: `luisardito-frontend` (Next.js 16 App Router, Vercel) — board https://github.com/users/NaferJ/projects/12

**Main issue**: backend [#83](https://github.com/NaferJ/luisardito-shop-backend/issues/83) — Comunidad API (posts, comments, votes). This plan extends it: likes-only, media, moderation, views.

**Hard rule for this sprint**: no commits or pushes without explicit user authorization.

---

## Decision log (locked)

| #   | Decision                                        | Rationale                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Likes only, no dislikes**                     | User prefers Twitter-style likes. `CommunityLike` table (user + target unique), score = like count. Simpler than #83's `CommunityVote` (+1/-1).                                                                                                              |
| D2  | **Media → Cloudinary**                          | Already integrated; frontend already does unsigned uploads via `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. Backend stores URLs/metadata only. Videos get free thumbs/streaming.                                                                                  |
| D3  | **Backups → Cloudflare R2**                     | GitHub LFS push is an anti-pattern (1GB quota, force-push on conflicts, repo ≠ backup store). R2: 10GB free, S3 API, zero egress, lifecycle rules for retention.                                                                                             |
| D4  | **Moderation = auto-scan + reports + hide**     | OpenAI `omni-moderation-latest` (free) scans post/comment text + media URLs on create → flagged items go `pending_review`. Users can report. Admins hide, never delete. Audit fields on every hide. Fallback if no OpenAI key: Sightengine (2k ops/mo free). |
| D5  | **News → Sanity CMS**                           | Frontend-only integration (Sanity CDN, no backend code). User already knows Sanity. Replaces hardcoded `src/lib/sidebar-promos.ts` cards.                                                                                                                    |
| D6  | **Remove AI working files from repo**           | `git rm --cached` + gitignore: `.ai/`, `.windsurf/`, `backup-antes-de-limpiar.bundle`, `backups/`. Keep committed: `AGENTS.md`, `.github/copilot-instructions.md`, issue/PR/commit templates (industry standard + useful).                                   |
| D7  | **Feed sorts: `new`, `top`, `hot`**             | `hot` = HN-style `score / (age_hours + 2)^1.8`. No personalized ranking in v1 — needs data volume we don't have. Revisit post-launch.                                                                                                                        |
| D8  | **Views: `view_count` + Redis dedup**           | Increment on `GET /posts/:id`, dedup `viewed:post:{id}:{userId                                                                                                                                                                                               | ip}` TTL 24h. Admin-only stats endpoint. PostHog in frontend later for product analytics (backlog item). |
| D9  | **Permissions via existing `permiso()` system** | Routes use `permiso("verbo")` + `permisos`/`rolPermiso` tables — NOT `authorize()`. New seeded permissions `moderar_comunidad`, `fijar_comunidad` granted to `developer`, `moderador`, `streamer`. No changes to existing role logic.                        |
| D10 | **Post page URL `/comunidad/[id]`**             | `generateMetadata` in App Router gives real OG tags → share/unfurl works. Cosmetic slug optional later.                                                                                                                                                      |

### Pending user decision

- ~~Reply notifications~~ → **YES (confirmed 2026-09-28)**. Backend emits `Notificacion` to post author on new comment. Frontend will rebuild the notifications UI (existing bell was removed for polish — notification data layer still ships from backend).

---

## API contract (frontend builds against this)

Base: `/api/community`

```
GET    /posts?sort=new|top|hot&page=&limit=   → { posts[], total, page, limit, pages }  (pinned first; limit max 50)
       each post: { id, title, body, slug, media[], pinned, status, view_count,
                    like_count, comment_count, top_comment, author{id,nickname,avatar},
                    creado, actualizado, viewer_liked }
POST   /posts          (auth)  { title, body, media[] }  → 201 post
GET    /posts/:id              → post + comments[] (increments view_count, deduped)
POST   /posts/:id/comments     (auth)  { body }          → 201 comment
POST   /posts/:id/like         (auth)  toggle            → { liked, like_count }
POST   /comments/:id/like      (auth)  toggle            → { liked, like_count }
POST   /posts/:id/report       (auth)  { reason? }       → 201
POST   /comments/:id/report    (auth)  { reason? }       → 201
DELETE /posts/:id              (auth; owner or moderar_comunidad) → soft-hide, never hard delete
DELETE /comments/:id           (auth; owner or moderar_comunidad) → soft-hide
PATCH  /posts/:id/pin          (permiso: fijar_comunidad)  { pinned: boolean }
PATCH  /posts/:id/hide         (permiso: moderar_comunidad)  { reason }
PATCH  /posts/:id/unhide       (permiso: moderar_comunidad)
PATCH  /comments/:id/hide|unhide (permiso: moderar_comunidad)
GET    /admin/community/queue  (permiso: moderar_comunidad) → flagged + reported items
GET    /admin/community/stats  (permiso: moderar_comunidad) → views/engagement aggregates
```

- `status`: `visible` | `pending_review` | `hidden` (hidden items excluded from public queries; admins see them).
- `top_comment`: highest-like visible comment, null if none — the Twitter-style "important reply" shown in feed cards.
- `media[]`: `[{ type: "image"|"video", url, thumbnail_url?, width?, height? }]` — Cloudinary URLs, uploaded unsigned by frontend first.
- Timestamps include date+hour (`creado`); frontend renders relative time.
- "Author" badge is frontend-derived: `comment.author.id === post.author.id`.

---

## Track A — Backend (this repo, board 13)

### A1. Community core — issue #83 (adapted to D1/D4/D7)

- [ ] Migrations + models: `CommunityPost` (usuario_id FK, title, body, slug, media JSON, pinned, status, view_count, hidden_by/hidden_at/hidden_reason, timestamps), `CommunityComment` (post_id FK, usuario_id FK, body, status + hidden_* fields), `CommunityLike` (polymorphic target_type post|comment + target_id + usuario_id, unique)
- [ ] `community` routes/controllers per API contract
- [ ] Seed permissions `moderar_comunidad`, `fijar_comunidad` → developer/moderador/streamer roles
- [ ] Jest: like toggle/uniqueness, pagination, sort=hot ordering, auth enforcement, hidden items excluded
- Gates: `npm run format:check && npm run lint && npm run typecheck && npm run build && npm test`

### A2. Moderation pipeline (D4)

- [ ] `moderation.service.ts` — OpenAI `omni-moderation-latest` call on text + media URLs; `OPENAI_API_KEY` env (document `.env.example`); graceful no-op if key missing
- [ ] On create → score → `visible` or `pending_review`
- [ ] `CommunityReport` model (reporter, target, reason, status, resolved_by/at) + report endpoints
- [ ] Admin queue + hide/unhide endpoints w/ audit fields
- [ ] Jest: flagging path, report flow, permission enforcement

### A3. Media support (D2)

- [ ] `media` JSON validation in Zod schema (max 4 items, cloudinary domain whitelist, type enum)
- [ ] Docs note: frontend uploads via unsigned preset BEFORE POST (same as product images)

### A4. Views + stats (D8)

- [ ] Redis dedup + `view_count` increment on `GET /posts/:id`
- [ ] `GET /admin/community/stats`

### A5. Reply notifications (confirmed)

- [ ] Emit `Notificacion` to post author on new comment (skip self-comments)

### A6. Backups → R2 (D3)

- [ ] `npm i @aws-sdk/client-s3` — regenerate lock in Linux container (`docker run --rm -v ${PWD}:/app -w /app node:22 npm install`) then `npm ci` — DO NOT `npm install` on Windows
- [ ] Replace `pushToGitHub()` (~250 lines of git/LFS juggling) with S3 `PutObject` + keep local `.sql.gz` tier
- [ ] Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` → `.env.example` + `config.ts`
- [ ] Set R2 lifecycle rule (delete after N days) via dashboard or API — replaces `cleanOldBackups` remote side
- [ ] Update restore path/docs (`scripts/restore-backup.js`, `diagnose-backups.js`)

---

## Track B — Frontend (`luisardito-frontend`, board 12)

### B1. Comunidad UI (parallel with A1–A4; contract above is frozen)

- [ ] `/comunidad` feed: sort tabs (new/top/hot), pinned posts first, `top_comment` preview card
- [ ] `/comunidad/[id]` post page: `generateMetadata` for OG/SEO, flat comments, like buttons
- [ ] Composer: text + media upload (unsigned Cloudinary preset, images + video)
- [ ] Report button, share button (native share + copy link), "Author" badge, relative timestamps
- [ ] Admin UI: pin/hide/unhide controls, moderation queue page, stats page (permiso-gated)

### B2. News via Sanity (D5)

- [ ] Sanity project + `newsItem` schema (title, body, image, publishedAt, sortOrder)
- [ ] Fetch via Sanity CDN in `SidebarPromoCards`; replace `src/lib/sidebar-promos.ts`
- [ ] Env: `NEXT_PUBLIC_SANITY_PROJECT_ID` / `DATASET` → `.env.example` + Vercel

### B3. Backlog (not this sprint)

- [ ] PostHog product analytics
- [ ] Cosmetic slugs in post URLs

---

## Track C — Ops / chores (backend repo)

### C1. Remove AI working files (D6)

- [ ] Add to `.gitignore`: `.ai/`, `.windsurf/`, `*.bundle` (`backups/`, `tokens/` already ignored)
- [ ] `git rm -r --cached .ai .windsurf backup-antes-de-limpiar.bundle` (files stay on disk; user commits when authorized)
- [ ] Keep: `AGENTS.md`, `.github/copilot-instructions.md`, `.github/ISSUE_TEMPLATE/`, `pull_request_template.md`, `git-commit-instructions.md`

### C2. Bot comments → Spanish, shorter

- [ ] Scope: `discordBot.service.ts`, `kickBot.service.ts`, `kickBotCommandHandler.service.ts`, `kickBotAutoSend.service.ts`, `kickModeratorCommands.service.ts`, `kickBotToken.service.ts`, `botMaintenance.service.ts`, webhook handlers
- [ ] English JSDoc → concise Spanish comments; code untouched. User reviews the diff.

---

## Board issues (filed 2026-09-28)

Backend (board 13):

- #83 — Comunidad API core (A1) — In Progress
- #86 — `ops` — Migrate DB backups from GitHub LFS to Cloudflare R2 (A6)
- #87 — `tooling` — Remove AI working files from repository (C1)
- #88 — `tooling` — Bot comments: English → Spanish, shorten (C2)
- #89 — `feature` — Comunidad: moderation pipeline (A2)
- #90 — `feature` — Comunidad: media support via Cloudinary (A3)
- #91 — `feature` — Comunidad: view tracking + admin stats (A4)
- #92 — `feature` — Comunidad: reply notifications (A5)
- #93 — `feature` — Kick moderators get community mod tools (future)

Frontend (board 12):

- #25 — Comunidad section UI (B1) — pre-existing
- #40 — `feature` — News section via Sanity CMS (B2)
- #41 — `feature` — Notifications UI rebuild (bell + dropdown)

---

## Session log

- **2026-09-28** — Plan created. Decisions D1–D10 locked. Reply notifications confirmed YES. All issues filed (backend #86–#93, frontend #40–#41; frontend #25 pre-exists). Starting Track A1 (community core).
- **2026-09-28 (later)** — A1 (#83) + A4 (#91 views) + A5 (#92 reply notifications) implemented, uncommitted. Gates green (611 tests). Deviations: no `slug` column (deferred B3); list query validated in controller (Express 5 `req.query` is getter-only); shared types in `src/types/community.types.ts`.
  - **Open follow-ups**: (1) Media regex accepts any Cloudinary account; could restrict to our cloud name in #90. (2) `.env` has a duplicate `REDIS_PASSWORD` line and `.env.development` carries a different value — harmless after the config precedence fix, worth tidying.
- **2026-09-29** — Verified against real dev DB (Docker): migrations up → undo x2 → up clean, permissions seeded (permisos 12/13 → roles 3/4/5), `comunidad_respuesta` enum live. Live smoke tests all pass: create/feed(hot+top)/comment/like-toggle/pin/soft-delete(403 stranger, 200 owner, audit fields written, post excluded from feed, 404 anon)/Redis view dedup (1st view counts, 2nd doesn't)/rate limit 30/min → 429.
  - Added: `express-rate-limit@8.7.0` (lock regenerated in Linux container, `npm ci` locally), `src/middleware/rateLimit.middleware.ts` (`communityWriteLimiter` 30/min keyed by user id→IP), `app.set("trust proxy", 1)`.
  - **Fixed pre-existing bug**: `config.ts` used `dotenv.config({override:true})` for `.env.development`, stomping compose env vars → container's Redis auth was silently broken (WRONGPASS). Now real env > .env.development > .env.
  - **Infra gotcha**: a WSL dev server shadows `:3001` on `localhost` — requests may not reach the Docker container. Use `127.0.0.1:3001` or in-container checks to test the container.
  - Board: #91, #92 moved to In Progress (implemented, uncommitted).
