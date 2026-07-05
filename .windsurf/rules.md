# Windsurf Agent Rules — luisardito-shop-backend

These rules are mandatory. Follow them on every task in this repository.

## 0. Working branch

- All dev-environment work goes on `chore/dev-environment-overhaul`.
- Never commit directly to main. Never open a PR unless explicitly told to.

## 1. Language: English only

- All code, comments, logs, commit messages, docs, and new identifiers MUST be in English.
- Never write Spanish in the codebase.
- When editing a file that has Spanish comments/strings, translate them to English as part of that change. Do not leave mixed-language files.
- Do NOT rename existing public API routes (e.g. /api/usuarios, /api/productos). The frontend depends on them. Renaming is a separate, explicit task.

## 2. No emojis

- Never add emojis to code, logs, comments, commit messages, or docs.
- When editing a file that contains emojis, remove them and replace with plain text.

## 3. Logging

- Use the existing logger in src/utils. Do NOT use console.log.
- Never log secrets or whether a secret "exists".

## 4. Environment / dev setup

- Keep .env.example as the single source of truth for env vars. Every variable read in config.js must appear there with a safe placeholder.
- Keep .gitignore excluding node_modules, .env* (except the example), /tokens, /backups, logs. Never commit real secrets.

## 5. Architecture & conventions

- Keep MVC layering: routes -> controllers -> services -> models. No business logic in route files.
- Consistent JSON responses and structured error handling; correct HTTP status codes; no stack traces in production responses.
- Keep the health endpoint working as a dependency-light liveness check.

## 6. Scripts hygiene

- Do NOT add new one-off scripts to scripts/ without a clear reason.
- When cleaning scripts, remove redundant OS-specific duplicates (.bat/.sh/.ps1 pairs) and keep one documented cross-platform path.

## 7. Commits (Conventional Commits, English)

- Format: type(scope): subject. Types: feat, fix, docs, style, refactor, perf, test, chore, ci.

## 8. Scope discipline

- Make only the change requested for the current step. Do not refactor unrelated files.
- Do NOT change public API contracts, DB schema, or migrations unless explicitly told to.
- If a task is ambiguous, state your assumption before proceeding.
