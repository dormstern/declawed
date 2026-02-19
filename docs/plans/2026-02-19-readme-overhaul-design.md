# Design: declawed README Overhaul

## Problem

A 15-year veteran cyber CTO couldn't figure out how to use declawed from the README. His feedback: "It's not clear how it works" and "show me a demo." Current README is 6 KB of syntax-first, proof-last content with zero visual demos.

Comparison with dormstern/segspec (which works): segspec leads with animated GIFs of real CLI output on real codebases (Sentry, PostHog). declawed leads with abstract before/after pseudocode and 4 policy examples before any proof.

## Decision

Approach A: Proof-first, API-last. Cut README from 6 KB to ~3 KB. Lead with a terminal GIF. Move reference docs to docs/API.md.

## New README Structure (~3 KB, ~120 lines)

```
1. HOOK
   "Your AI agent has your credentials. This gives it rules."
   "Policy, audit, kill switch — in 5 lines of YAML."

2. BADGES (npm, license, tests, CI)

3. DEMO GIF (3-7s terminal recording)
   Real AnchorBrowser session (unlimited credits available).
   Shows: create shield → allowed task → blocked task → status → audit
   File: docs/demos/declawed-demo.gif

4. THE PROBLEM (2 sentences)
   42K credentials leaked from AI agent workflows.
   declawed = policy file + audit log + kill switch. Not a Mac Mini.

5. QUICK START (3 steps, zero prose)
   1. npm install declawed
   2. shield.yaml (one compact policy)
   3. TypeScript (import, create, task — 3 lines)
   "That's it."

6. HOW IT WORKS (ASCII flow — keep existing)

7. CLI (compact — status, audit, kill in one block)

8. Link to full API docs: docs/API.md

9. EMPOWERED BY ANCHORBROWSER (keep current)

10. WHY THIS EXISTS (3 lines) + Built by Behalf

11. LICENSE
```

## What Moves to docs/API.md

- Full API reference (createShield, shield.task, shield.kill, shield.audit, shield.status)
- 4 policy examples (restrictive, permissive, time-boxed, inline)
- Pattern matching rules
- Security details
- Testing philosophy
- Audit log format + JSONL explanation
- Kill switch details (code + CLI + status)

README links to it: `[Full API reference & policy examples →](./docs/API.md)`

## Demo GIF Approach

- Script: `scripts/record-demo.ts` — runs real AnchorBrowser session with declawed governance
- Shows colorized terminal output: green ALLOWED, red BLOCKED
- Ends with `npx declawed status` showing counts
- Record with `vhs` (Charm terminal recorder) or manual asciinema → gif
- 3-7 seconds, committed to `docs/demos/declawed-demo.gif`
- Real session (AnchorBrowser credits unlimited, CEO wants to promote)

## Files

| File | Action |
|------|--------|
| README.md | Rewrite (6 KB → 3 KB) |
| docs/API.md | New (extracted reference content) |
| docs/demos/declawed-demo.gif | New (terminal recording) |
| scripts/record-demo.ts | New (demo script with real AnchorBrowser) |

## Success Criteria

- A cyber CTO reads the README and knows exactly what declawed does in 10 seconds
- The GIF alone tells the whole story
- Quick Start is copy-pasteable without reading anything else
- AnchorBrowser CEO screenshots the README for their BD deck
