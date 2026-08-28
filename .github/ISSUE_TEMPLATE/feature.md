## What

<!-- What needs to be built? Name the endpoint, service, model, or feature
     concretely (e.g. expose subscription_duration_months in the leaderboard
     response, add a /api/promociones/:id/restore endpoint, new Kick webhook
     handler). -->

## Why

<!-- The motivation / user need. Link the project board, related PR, frontend
     consumer, or context if relevant. If this unblocks a frontend issue,
     note it here (e.g. "Unblocks luisardito-shop-frontend#NN"). -->

## Scope

<!-- Bullet list of what is included in this issue. Be concrete about
     endpoints, services, models, migrations, and response shapes. -->

-
-
-

## Non-goals

<!-- What is explicitly NOT included. Call out endpoints, services, models,
     migrations, or frontend changes that will not be touched. -->

-
-

## Blocked on

<!-- Optional. Dependencies, frontend changes, Kick/Discord API access,
     database migrations, or decisions that must land before this can start.
     Remove this section if nothing is blocking. -->

-

## Acceptance criteria

<!-- Checkboxes that must all be ticked before the issue is closed. -->

- [ ] Endpoint / service implemented
- [ ] Response shape matches the contract (document the fields)
- [ ] Migration added (if schema changes) and runs up/down cleanly
- [ ] `npm run format:check` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes (add/updated tests if applicable)
- [ ] Linked PR merged

## Verification (local gates — all must be green)

- `npm ci`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
