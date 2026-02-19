# Behalf Shield

> Your AI agent has your credentials. This gives it rules.

## The Problem

People are buying dedicated Mac Minis just to run [OpenClaw](https://github.com/corbt/openai-cua) because they don't trust it with their own accounts. That's not security — that's surrender.

OpenClaw agents get **full access** to your LinkedIn, Salesforce, Gmail — with zero scoping, zero audit trail, and zero kill switch. When [42,000 live credentials leaked from AI agent workflows](https://www.wired.com/story/ai-agent-credential-leaks/), the community's response was hardware isolation. A separate computer for your agent.

**Shield replaces the Mac Mini.** Five lines of YAML. One import swap. Your agent gets rules — not a separate computer.

## 5-Minute Setup

### 1. Install

```bash
npm install behalf-shield
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
import { createShield } from 'behalf-shield'

const shield = createShield('./shield.yaml')

// Every task is policy-checked + audited
const result = await shield.task('read my inbox')
// → { allowed: true, output: '...' }

const result2 = await shield.task('send message to Bob')
// → { allowed: false, reason: 'blocked by deny pattern: *send*' }
```

That's it. Your agent now has rules.

## How It Works

```
Your Code
    ↓
behalf-shield (policy check + audit)
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
npx behalf-shield kill
# → Session mock-session-123 killed.
```

### Check status

```bash
npx behalf-shield status
# Agent:   inbox-assistant
# Status:  active
# Allowed: 23
# Blocked: 3
# Total:   27

npx behalf-shield audit
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

## Why This Exists

AI agents are getting credential access with zero governance. The OpenClaw credential leak showed what happens when agents operate without rules — 42,000 live credentials exposed. The community's workaround is buying separate hardware. That's expensive, fragile, and doesn't scale.

Shield gives agents what they should have had from the start: **a policy file, an audit log, and a kill switch.**

5 lines of YAML. One import. Zero new infrastructure.

Built by [Behalf](https://behalf-gray.vercel.app) — delegation governance for the agent era.

## License

MIT
