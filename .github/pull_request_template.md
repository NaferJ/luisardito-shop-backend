## Issue

<!-- Link the issue this PR closes. This auto-closes the issue on merge
     and moves the project board card to Done. -->

Closes #

## What

<!-- What does this PR change? Be concrete. For refactors, state it is
     behavior-preserving. For API changes, document the new/changed response
     shape. -->

## Why

<!-- The problem/motivation. Link the related issue, ticket, or context if
     relevant. If this unblocks a frontend issue, note it here. -->

## Scope / Non-goals

<!-- What this PR deliberately does NOT touch: endpoints, services, models,
     migrations, env vars, Kick/Discord integrations. State the
     behavior-preserving guarantee here if it's a refactor or chore. -->

## API / schema impact

<!-- Does this change the API response shape or the database schema?
     - API: list the new/changed/removed fields per endpoint.
     - Schema: list migration filenames and whether they are reversible.
     If neither, state "No API or schema change". -->

## Verification (local gates — all must be green)

- `npm ci`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`

## Merge checks (must pass before merge)

- CI (`ci.yml`: `npm ci`, `npm test`, Docker build)

## Rollback

<!-- How to revert and why it's safe (e.g. single-commit revert, docs-only,
     reversible migration, no data impact). If a migration is involved, state
     the down-migration path. -->
