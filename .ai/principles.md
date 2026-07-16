# AI Pair-Programming Principles — Luisardito Shop Backend

Use this as a reminder before starting any new coding session.

## Workflow

- **One branch = one logical concern.** Not one file change. Group related tiny cleanups.
- **If CI / Quality Gate passed, ship it.** Do not chase every Sonar warning or 0% duplication.
- **Fix before prod:** security, auth, crashes, broken data. Style/duplication can come after.
- **Spend time on user-facing features, not endless polishing.** The car should drive, not just shine.

## Working with the AI

- **I make the decision.** Ask the AI for 2–3 options with trade-offs, then I choose.
- **When unsure, pick the simplest option that matches the existing code.**
- **Timebox decisions.** 20 minutes to decide, then move.
- **After every session, explain the change out loud in my own words.** If I can't, I didn't learn it.
- **Keep handoff context short.** Only current task, stack, conventions, and open items.

## PR size

- One PR should have a single clear reason for a reviewer to read it.
- Batch tiny changes: renames, comment fixes, placeholder updates, config tweaks.

## Mindset

- Done is better than perfect.
- Progress is invisible when the AI does the visible work. I must own the decisions.
- My English is good enough. Stop using it as an excuse.
