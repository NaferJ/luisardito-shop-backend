Generates ONE commit message in Conventional Commits format, ALL in English.  
  
Available TYPES: feat, fix, refactor, chore, docs, style, test, perf, ci, build, revert  
  
EXACT Format:  
type(scope): Short title in English  
  
Description in English (1-2 lines max, what + why).  
  
Rules:  
- Scope is MANDATORY: always type(scope): — never bare "type:". If unsure, pick the closest area (auth), (api), (git), (docs).  
- Title: Imperative, <50 characters  
- Body: MANDATORY two parts in this order — (1) one sentence stating WHAT changed, (2) one sentence stating WHY / the benefit. Never stop after the "what". The body is always at least two sentences.  
- MANDATORY structure — output EXACTLY three parts in this order:  
    line 1: the title  
    line 2: EMPTY (a real blank line, zero characters)  
    line 3+: the body  
  Never merge the title and body onto adjacent lines. There MUST be an empty line between them.  
- NO refs, NO branch  
  
Changes: [DESCRIBE YOUR CHANGE IN 1 SENTENCE]  
  
Correct (scope present, blank line, body has WHAT + WHY):  
docs(git): add commit message guidelines  
  
Provides a clear structure for writing commit messages in Conventional Commits format. Ensures consistency and clarity across all repository contributions.  
  
WRONG (body stops after the "what", missing the WHY/benefit) — do NOT do this:  
docs(git): add commit message guidelines  
  
Provides a clear structure for writing commit messages in Conventional Commits format.  
  
WRONG (title and body glued together, no empty line) — do NOT do this:  
docs(git): add commit message guidelines  
Provides a clear structure for writing commit messages in Conventional Commits format. Ensures consistency and clarity across all repository contributions.  
  
WRONG (missing scope) — do NOT do this:  
docs: add commit message guidelines  
  
Provides a clear structure for writing commit messages in Conventional Commits format. Ensures consistency and clarity across all repository contributions.  
  
Correct example:  
feat(celebrities): Pause autoplay on hover  
  
Adds pause/resume to the celebrity carousel when hovering over controls or areas. Reset timer in manual navigation to avoid immediate transitions.