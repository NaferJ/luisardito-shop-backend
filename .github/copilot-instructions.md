# Copilot custom instructions — luisardito-shop-backend

GitHub Copilot reads this file as repo-wide custom instructions across editors
(VS Code + JetBrains). Follow these rules on every suggestion and commit message
in this repository.

## Code conventions

- English only in all code, comments, logs, identifiers, commit messages, and
  docs. No Spanish. When editing a file with Spanish comments/strings, translate
  them to English as part of that change.
- No emojis anywhere in code, logs, comments, commit messages, or docs.
- Use the existing logger in `src/utils`. Never `console.log`. Never log secrets
  or whether a secret "exists".
- Keep MVC layering: routes -> controllers -> services -> models. No business
  logic in route files.
- Do NOT rename existing public API routes (e.g. `/api/usuarios`,
  `/api/productos`); the frontend depends on them. Renaming is a separate,
  explicit task.
- Do NOT change DB schema or migrations unless explicitly asked.
- Use Conventional Commits, in English.

## Commit messages

```
Generates ONE commit message in Conventional Commits format, ALL in English.

Available TYPES: feat, fix, refactor, chore, docs, style, test, perf, ci, build, revert

EXACT Format:
type(scope): Short title in English

Description in English (1-2 lines max, what + why).

Rules:
- Scope in English: (navbar), (auth), (api), (carousel)
- Title: Imperative, <50 characters
- Body: Concise, explains the benefit
- BLANK LINE between title and body
- NO refs, NO branch

Changes: [DESCRIBE YOUR CHANGE IN 1 SENTENCE]

Exact example:
feat(celebrities): Pause autoplay on hover

Adds pause/resume to the celebrity carousel when hovering over controls or areas. Reset timer in manual navigation to avoid immediate transitions.
```
