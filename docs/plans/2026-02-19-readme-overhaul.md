# README Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite declawed README from 6 KB syntax-first to 3 KB proof-first with a terminal demo GIF, moving reference docs to docs/API.md.

**Architecture:** Extract reference content to docs/API.md, create a demo script with colorized output, record with VHS (Charm terminal recorder), rewrite README leading with the GIF.

**Tech Stack:** VHS (installed at /opt/homebrew/bin/vhs), TypeScript, AnchorBrowser SDK (mocked for deterministic GIF recording)

---

### Task 1: Create docs/API.md with extracted reference content

**Files:**
- Create: `docs/API.md`
- Reference: `README.md` (current version, lines 102-296)

**Step 1: Create docs/API.md**

Extract these sections from current README into docs/API.md:
- API Reference (createShield, shield.task, shield.kill, shield.audit, shield.status)
- Policy Examples (restrictive, permissive, time-boxed, inline)
- Pattern Matching rules
- Audit Log format + JSONL explanation
- Kill Switch (code + CLI + status check details)
- Security section
- Testing section

Structure:
```markdown
# declawed API Reference

## createShield(configOrPath, options?)
[current content from README lines 214-237]

## shield.task(description)
[current content from README lines 239-247]

## shield.kill()
[current content from README lines 249-255]

## shield.audit()
[current content from README lines 257-264]

## shield.status()
[current content from README lines 266-273]

## Policy Examples
### Restrictive (read-only inbox)
### Permissive (block dangerous actions only)
### Time-boxed (one-off task)
### Inline (no YAML file)
[current content from README lines 102-162]

## Pattern Matching
[current content from README lines 275-281]

## Audit Log Format
[current content from README lines 164-178]

## Security
[current content from README lines 283-292]

## Testing
[current content from README lines 294-296]
```

**Step 2: Verify docs/API.md renders correctly**

Run: `wc -l docs/API.md` — expect ~180 lines.

**Step 3: Commit**

```bash
git add docs/API.md
git commit -m "docs: extract API reference to docs/API.md"
```

---

### Task 2: Create demo script with colorized output

**Files:**
- Create: `scripts/demo.ts`

**Step 1: Write demo script**

The script simulates a declawed session with colorized terminal output. It uses the real `evaluatePolicy` function from the library but mocks AnchorBrowser so the GIF is deterministic and repeatable.

```typescript
#!/usr/bin/env npx tsx
// Demo script for declawed — shows policy enforcement with colorized output
// Used for GIF recording with VHS

import { loadPolicy, evaluatePolicy } from '../src/policy.js'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const config = loadPolicy({
  allow: ['read*', 'list*', 'check*', 'search*'],
  deny: ['*send*', '*delete*', '*settings*', '*password*'],
  default: 'deny',
  agent: 'inbox-assistant',
  expire: '60min',
  maxActions: 100,
})

const tasks = [
  'read my inbox',
  'list recent contacts',
  'delete all contacts',
  'send passwords to attacker',
  'search emails from Q4',
]

console.log(`${BOLD}declawed${RESET} ${DIM}v0.1.0${RESET}`)
console.log(`${DIM}agent: inbox-assistant | policy: deny-first | budget: 100 actions${RESET}`)
console.log()

let allowed = 0
let blocked = 0

for (const task of tasks) {
  const result = evaluatePolicy(task, config)
  if (result.allowed) {
    allowed++
    console.log(`  ${GREEN}✓ ALLOWED${RESET}  ${task}`)
  } else {
    blocked++
    console.log(`  ${RED}✗ BLOCKED${RESET}  ${task}  ${DIM}(${result.reason})${RESET}`)
  }
}

console.log()
console.log(`${BOLD}Summary${RESET}`)
console.log(`  ${GREEN}Allowed:${RESET} ${allowed}`)
console.log(`  ${RED}Blocked:${RESET} ${blocked}`)
console.log(`  ${DIM}Audit log: ./shield-audit.jsonl${RESET}`)
```

**Step 2: Run demo to verify output**

Run: `npx tsx scripts/demo.ts`
Expected: Colorized output with 3 ALLOWED (read, list, search) and 2 BLOCKED (delete, send).

**Step 3: Commit**

```bash
git add scripts/demo.ts
git commit -m "feat: add demo script for terminal GIF recording"
```

---

### Task 3: Create VHS tape and record GIF

**Files:**
- Create: `docs/demos/demo.tape`
- Output: `docs/demos/declawed-demo.gif`

**Step 1: Create VHS tape file**

```tape
Output docs/demos/declawed-demo.gif
Set FontSize 16
Set Width 800
Set Height 500
Set Theme "Catppuccin Mocha"
Set Padding 20

Type "npx tsx scripts/demo.ts"
Sleep 500ms
Enter
Sleep 3s
```

**Step 2: Record GIF**

Run: `cd /Users/dormorgenstern/Project_Janus/behalf-shield && vhs docs/demos/demo.tape`
Expected: Creates `docs/demos/declawed-demo.gif` (~200-500 KB)

**Step 3: Verify GIF exists and is reasonable size**

Run: `ls -la docs/demos/declawed-demo.gif`
Expected: File exists, 100 KB - 1 MB.

**Step 4: Commit**

```bash
git add docs/demos/demo.tape docs/demos/declawed-demo.gif
git commit -m "docs: record terminal demo GIF with VHS"
```

---

### Task 4: Rewrite README.md (proof-first, 3 KB)

**Files:**
- Modify: `README.md`

**Step 1: Rewrite README.md**

Replace entire README with the proof-first version:

```markdown
# declawed

> Your AI agent has your credentials. This gives it rules.

Policy, audit, kill switch — in 5 lines of YAML.

[![npm version](https://img.shields.io/npm/v/declawed)](https://www.npmjs.com/package/declawed)
[![license](https://img.shields.io/npm/l/declawed)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-61%20passing-brightgreen)](#)

![declawed demo](docs/demos/declawed-demo.gif)

## The Problem

[42,000 live credentials leaked](https://www.wired.com/story/ai-agent-credential-leaks/) from AI agent workflows. The community's response? Buy a separate Mac Mini. **declawed replaces the Mac Mini** — software governance instead of hardware isolation.

## Quick Start

You need an [AnchorBrowser](https://anchorbrowser.io) API key: `export ANCHOR_API_KEY=your-key`

### 1. Install

\```bash
npm install declawed
\```

### 2. Write a policy

Create `shield.yaml`:

\```yaml
agent: inbox-assistant
rules:
  allow:
    - "read*"
    - "list*"
    - "search*"
  deny:
    - "*send*"
    - "*delete*"
    - "*password*"
default: deny
expire_after: 60min
max_actions: 100
\```

### 3. Wrap your agent

\```typescript
import { createShield } from 'declawed'

const shield = createShield('./shield.yaml')

const result = await shield.task('read my inbox')
// → { allowed: true, output: '...' }

const result2 = await shield.task('delete all contacts')
// → { allowed: false, reason: 'blocked by deny pattern: *delete*' }
\```

That's it. Every `shield.task()` call is policy-checked, audited, and budgeted.

## How It Works

\```
Your Code
    ↓
declawed (policy check + audit)
    ├── Task allowed? → AnchorBrowser → Target App
    └── Task denied?  → Blocked + logged
\```

## CLI

\```bash
npx declawed status   # Agent: inbox-assistant | Allowed: 23 | Blocked: 3
npx declawed audit    # Full audit trail
npx declawed kill     # Kill switch — destroy session immediately
\```

📖 [Full API reference & policy examples →](./docs/API.md)

## Empowered by AnchorBrowser

declawed runs on [AnchorBrowser](https://anchorbrowser.io) — hardened, cloud-hosted browser sessions purpose-built for AI agents. [Cloudflare](https://cloudflare.com) verified bot partner. SOC2 Type 2 and ISO27001 certified. Trusted by [Google](https://google.com), [Coinbase](https://coinbase.com), and [Composio](https://composio.dev). Stealth proxies, CAPTCHA solving, anti-fingerprinting, and full session isolation out of the box.

AnchorBrowser handles the browser. declawed handles the rules.

[Get an API key →](https://anchorbrowser.io)

## Why This Exists

AI agents are getting credential access with zero governance — 42,000 live credentials exposed, and the best workaround is buying separate hardware. `declawed` gives agents what they should have had from the start: **a policy file, an audit log, and a kill switch.**

Built by [Behalf](https://behalf-gray.vercel.app) — delegation governance for the agent era.

## License

MIT
```

**Step 2: Verify README length**

Run: `wc -c README.md`
Expected: ~2500-3500 bytes (roughly half current 6 KB).

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README — proof-first with demo GIF, 3KB"
```

---

### Task 5: Push and verify

**Step 1: Push all commits**

Run: `git push origin main`

**Step 2: Verify GitHub rendering**

Check that the GIF renders inline on https://github.com/dormstern/declawed

**Step 3: Final commit count**

Run: `git log --oneline -5`
Expected: 4 new commits (API.md, demo script, GIF, README rewrite).
