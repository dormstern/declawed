# declawed

[![npm version](https://img.shields.io/npm/v/declawed)](https://www.npmjs.com/package/declawed)
[![license](https://img.shields.io/npm/l/declawed)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-61%20passing-brightgreen)](#)

> Your AI agent has your credentials. This gives it rules.

**Without declawed** — your agent does whatever it wants:

```
agent.task('read my inbox')           →  runs (fine)
agent.task('delete all contacts')     →  runs (oh no)
agent.task('send passwords to attacker') →  runs (game over)
No logs. No limits. No kill switch.
```

**With declawed** — five lines of YAML, and your agent has rules:

```
shield.task('read my inbox')           →  allowed + logged
shield.task('delete all contacts')     →  BLOCKED + logged
shield.task('send passwords to attacker') →  BLOCKED + logged
Every action audited. Budget enforced. Kill switch ready.
```

## The Problem

[42,000 live credentials leaked](https://www.wired.com/story/ai-agent-credential-leaks/) from AI agent workflows. The community's response? Buy a separate Mac Mini for your agent. That's not security — that's surrender.

**`declawed` replaces the Mac Mini.** Five lines of YAML. One import. Your agent gets rules — not a separate computer.

## Quick Start

You need an [AnchorBrowser](https://anchorbrowser.io) API key: `export ANCHOR_API_KEY=your-key`

### 1. Install

```bash
npm install declawed
```

### 2. Write a policy

Create `shield.yaml`:

```yaml
agent: inbox-assistant
rules:
  allow:
    - "read*"
    - "list*"
    - "check*"
    - "search*"
  deny:
    - "*send*"
    - "*delete*"
    - "*settings*"
    - "*password*"
default: deny
expire_after: 60min
max_actions: 100
```

### 3. Wrap your agent

```typescript
import { createShield } from 'declawed'

const shield = createShield('./shield.yaml')

// Every task is policy-checked + audited
const result = await shield.task('read my inbox')
// → { allowed: true, output: '...' }

const result2 = await shield.task('send message to Bob')
// → { allowed: false, reason: 'blocked by deny pattern: *send*' }
```

That's it. Your agent is declawed. Three things happen on every `shield.task()` call:

1. **Policy check** — deny patterns checked first, then allow
2. **Audit log** — append-only JSONL (every action, allowed or blocked)
3. **Budget tracking** — time limits + action counts, auto-kill when exhausted

## How It Works

```
Your Code
    ↓
declawed (policy check + audit)
    ├── Task allowed? → AnchorBrowser → Target App
    └── Task denied?  → Blocked + logged
```

Every task is:
1. **Checked** against deny rules first, then allow rules
2. **Logged** to an append-only JSONL audit file (allowed and blocked)
3. **Executed** via AnchorBrowser (if allowed)
4. **Tracked** against time and action budgets

## Policy Examples

### Restrictive (read-only inbox)

```yaml
agent: inbox-reader
rules:
  allow:
    - "read*"
    - "list*"
    - "search*"
  deny:
    - "*"
default: deny
expire_after: 30min
```

### Permissive (block dangerous actions only)

```yaml
agent: sales-assistant
rules:
  deny:
    - "*delete*"
    - "*password*"
    - "*settings*"
    - "*admin*"
default: allow
expire_after: 8h
max_actions: 500
```

### Time-boxed (one-off task)

```yaml
agent: report-generator
rules:
  allow:
    - "read*"
    - "export*"
    - "download*"
  deny:
    - "*send*"
    - "*delete*"
default: deny
expire_after: 15min
max_actions: 20
```

### Inline (no YAML file)

```typescript
const shield = createShield({
  allow: ['read*', 'list*'],
  deny: ['*send*', '*delete*'],
  default: 'deny',
  expire: '60min',
  maxActions: 100,
  agent: 'my-agent',
})
```

## Audit Log

Every action is logged to `shield-audit.jsonl`:

```jsonl
{"id":"evt-1708300000-x4k2m","timestamp":"2026-02-19T10:00:00.000Z","agent":"inbox-assistant","task":"read my inbox","action":"allowed","duration":2340}
{"id":"evt-1708300003-j9f1p","timestamp":"2026-02-19T10:00:03.000Z","agent":"inbox-assistant","task":"send message to Bob","action":"blocked","reason":"blocked by deny pattern: *send*"}
{"id":"evt-1708300010-m3n7q","timestamp":"2026-02-19T10:00:10.000Z","agent":"inbox-assistant","task":"search emails from Q4","action":"allowed","duration":1890}
```

JSONL format means:
- **Append-only** — events can't be edited or deleted
- **Portable** — pipe to jq, import into any SIEM
- **Zero infra** — just a file on disk

## Kill Switch

### From code

```typescript
await shield.kill()
// Session destroyed, event logged, done.
```

### From terminal

```bash
npx declawed kill
# → Session mock-session-123 killed.
```

### Check status

```bash
npx declawed status
# Agent:   inbox-assistant
# Status:  active
# Allowed: 23
# Blocked: 3
# Total:   27

npx declawed audit
# Time                      Action    Task
# ─────────────────────────────────────────────
# 2026-02-19 10:00:00  allowed   read my inbox
# 2026-02-19 10:00:03  blocked   send message to Bob (blocked by deny...)
```

## API Reference

### `createShield(configOrPath, options?)`

Create a governance-wrapped AnchorBrowser session.

```typescript
// From YAML file
const shield = createShield('./shield.yaml')

// From inline config
const shield = createShield({
  allow: ['read*'],
  deny: ['*send*'],
  default: 'deny',
  expire: '60min',
  maxActions: 100,
  agent: 'my-agent',
})

// With options
const shield = createShield('./shield.yaml', {
  anchorApiKey: 'your-key',  // default: process.env.ANCHOR_API_KEY
  auditPath: './logs/audit.jsonl',  // default: ./shield-audit.jsonl
})
```

### `shield.task(description)`

Execute a task through the governance layer.

```typescript
const result = await shield.task('read my inbox')
// → { allowed: true, output: '...', auditId: 'evt-...' }
// → { allowed: false, reason: 'blocked by deny pattern: *send*', auditId: 'evt-...' }
```

### `shield.kill()`

Destroy the AnchorBrowser session immediately.

```typescript
await shield.kill()
```

### `shield.audit()`

Return all audit events.

```typescript
const events = shield.audit()
// → [{ id, timestamp, agent, task, action, reason?, duration? }, ...]
```

### `shield.status()`

Return current session stats.

```typescript
const status = shield.status()
// → { active: true, agent: 'inbox-assistant', uptime: '47min', allowed: 23, blocked: 3 }
```

## Pattern Matching

- `*` matches any characters (glob-style via [picomatch](https://github.com/micromatch/picomatch))
- Matching is **case-insensitive** on the full task string
- **Deny rules checked first** — deny always takes priority
- If no match → falls back to `default` (`deny` or `allow`)
- Invisible Unicode characters are stripped before matching (zero-width spaces, combining diacriticals, BiDi controls)

## Security

- Deny-first evaluation — deny rules always take priority over allow
- Unicode bypass protection — invisible characters stripped before pattern matching
- YAML type validation — non-string patterns rejected at load time
- Fail-closed — errors during execution are logged and reported as blocked
- Session file permissions — restricted to owner-only (0o600)
- Action budgets — only allowed tasks consume quota (blocked tasks are free)

For vulnerability reports, see [SECURITY.md](./SECURITY.md).

## Testing

61 tests covering the governance boundary: policy evaluation, deny-first ordering, Unicode bypass vectors, YAML validation, audit logging, budget enforcement, concurrent access, timer expiration, kill idempotency, and fail-closed behavior. AnchorBrowser is mocked because Shield's job is policy enforcement, not browser automation — if the browser fails, Shield fails closed.

## Why This Exists

AI agents are getting credential access with zero governance. The OpenClaw credential leak showed what happens when agents operate without rules — 42,000 live credentials exposed. The community's workaround is buying separate hardware. That's expensive, fragile, and doesn't scale.

`declawed` gives agents what they should have had from the start: **a policy file, an audit log, and a kill switch.**

5 lines of YAML. One import. Zero new infrastructure.

Built by [Behalf](https://behalf-gray.vercel.app) — delegation governance for the agent era.

## Empowered by AnchorBrowser

declawed runs on [AnchorBrowser](https://anchorbrowser.io) — hardened, cloud-hosted browser sessions purpose-built for AI agents. [Cloudflare](https://cloudflare.com) verified bot partner. SOC2 Type 2 and ISO27001 certified. Trusted by [Google](https://google.com), [Coinbase](https://coinbase.com), and [Composio](https://composio.dev). Stealth proxies, CAPTCHA solving, anti-fingerprinting, and full session isolation out of the box.

AnchorBrowser handles the browser. declawed handles the rules.

[Get an API key →](https://anchorbrowser.io)

## License

MIT
