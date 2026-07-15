## What

<!-- What does this PR change? Be concrete. For refactors, state it is behavior-preserving. -->

## Why

<!-- The problem/motivation. Link the SonarCloud issue or ticket if relevant. -->

## Scope / Non-goals

<!-- What this PR deliberately does NOT touch: public API routes, DB schema/migrations,
     other modules. State the behavior-preserving guarantee here. -->

## Verification

<!-- Paste the gate results. All must be green. -->

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm test -- --forceExit`
- [ ] `npm run build`
- [ ] `npm run smoke`
- [ ] (refactors) characterization test passes against BOTH original and refactored code

## Rollback

<!-- How to revert and why it's safe (e.g. single-commit revert, no data/migration impact). -->
