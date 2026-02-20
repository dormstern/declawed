# leashed API Reference

## `createLeash(configOrPath, options?)`

Create a governance-wrapped AnchorBrowser session.

```typescript
// From YAML file
const leash = createLeash('./leash.yaml')

// From inline config
const leash = createLeash({
  allow: ['read*'],
  deny: ['*send*'],
  default: 'deny',
  expire: '60min',
  maxActions: 100,
  agent: 'my-agent',
})

// With options
const leash = createLeash('./leash.yaml', {
  anchorApiKey: 'your-key',  // default: process.env.ANCHOR_API_KEY
  auditPath: './logs/audit.jsonl',  // default: ./leash-audit.jsonl
})
```

## `leash.task(description)`

Execute a task through the governance layer.

```typescript
const result = await leash.task('read my inbox')
// → { allowed: true, output: '...', auditId: 'evt-...' }
// → { allowed: false, reason: 'blocked by deny pattern: *send*', auditId: 'evt-...' }
```

## `leash.yank()`

Destroy the AnchorBrowser session immediately.

```typescript
await leash.yank()
// Session destroyed, event logged, done.
```

## `leash.audit()`

Return all audit events.

```typescript
const events = leash.audit()
// → [{ id, timestamp, agent, task, action, reason?, duration? }, ...]
```

## `leash.status()`

Return current session stats.

```typescript
const status = leash.status()
// → { active: true, agent: 'inbox-assistant', uptime: '47min', allowed: 23, blocked: 3 }
```

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
const leash = createLeash({
  allow: ['read*', 'list*'],
  deny: ['*send*', '*delete*'],
  default: 'deny',
  expire: '60min',
  maxActions: 100,
  agent: 'my-agent',
})
```

## Pattern Matching

- `*` matches any characters (glob-style via [picomatch](https://github.com/micromatch/picomatch))
- Matching is **case-insensitive** on the full task string
- **Deny rules checked first** — deny always takes priority
- If no match → falls back to `default` (`deny` or `allow`)
- Invisible Unicode characters are stripped before matching (zero-width spaces, combining diacriticals, BiDi controls)

## Audit Log Format

Every action is logged to `leash-audit.jsonl`:

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
await leash.yank()
```

### From terminal

```bash
npx leashed kill
# → Session mock-session-123 killed.
```

### Check status

```bash
npx leashed status
# Agent:   inbox-assistant
# Status:  active
# Allowed: 23
# Blocked: 3
# Total:   27

npx leashed audit
# Time                      Action    Task
# ─────────────────────────────────────────────
# 2026-02-19 10:00:00  allowed   read my inbox
# 2026-02-19 10:00:03  blocked   send message to Bob (blocked by deny...)
```

## Security

- Deny-first evaluation — deny rules always take priority over allow
- Unicode bypass protection — invisible characters stripped before pattern matching
- YAML type validation — non-string patterns rejected at load time
- Fail-closed — errors during execution are logged and reported as blocked
- Session file permissions — restricted to owner-only (0o600)
- Action budgets — only allowed tasks consume quota (blocked tasks are free)

For vulnerability reports, see [SECURITY.md](../SECURITY.md).

## Testing

61 tests covering the governance boundary: policy evaluation, deny-first ordering, Unicode bypass vectors, YAML validation, audit logging, budget enforcement, concurrent access, timer expiration, kill idempotency, and fail-closed behavior. AnchorBrowser is mocked because leashed's job is policy enforcement, not browser automation — if the browser fails, leashed fails closed.
