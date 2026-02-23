# leashed

> AI got hands. This is the leash.

Policy, audit, kill switch for any AI agent with access to your accounts.

[![npm version](https://img.shields.io/npm/v/leashed?color=blue)](https://www.npmjs.com/package/leashed)
[![license](https://img.shields.io/npm/l/leashed)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-67%20passing-brightgreen)](#)
[![CI](https://github.com/dormstern/leashed/actions/workflows/ci.yml/badge.svg)](https://github.com/dormstern/leashed/actions/workflows/ci.yml)

### OpenClaw sales bot — leashed

![OpenClaw demo](docs/demos/openclaw-demo.gif)

### Work assistant (Claude, Devin, etc.) — leashed

![Work assistant demo](docs/demos/work-assistant-demo.gif)

## Quick Start

You need an [AnchorBrowser](https://anchorbrowser.io) API key: `export ANCHOR_API_KEY=your-key`

### 1. Install

```bash
npm install leashed
```

### 2. Write a policy

Create `leash.yaml`:

```yaml
agent: my-sales-bot
rules:
  allow:
    - "read*"
    - "list*"
    - "check*"
    - "search*"
  deny:
    - "*send*"
    - "*delete*"
    - "*export*"
    - "*password*"
default: deny
expire_after: 60min
max_actions: 50
```

### 3. Wrap your agent

```typescript
import { createLeash } from 'leashed'

const leash = createLeash('./leash.yaml')

const result = await leash.task('check linkedin inbox')
// → { allowed: true, output: '...' }

const result2 = await leash.task('export all contacts to CSV')
// → { allowed: false, reason: 'blocked by deny pattern: *export*' }
```

Every `leash.task()` call is policy-checked, audited, and budgeted.

## How It Works

1. **Credential isolation** — your password stays in an isolated cloud browser. The agent gets a pre-authenticated session, never the credentials themselves.
2. **Scoped boundaries** — tasks that don't match your policy are blocked before they start. Deny-first pattern matching with Unicode bypass protection.
3. **Audit + kill switch** — every action logged (allowed and blocked). Budget enforced. Session destruction when you're done.

## Security Model

leashed is **application-layer authz for AI agents** — it governs what agents are *authorized to do*, not who they are or what credentials they hold.

### What leashed enforces

| Layer | How |
|-------|-----|
| Task gating | Deny-first glob pattern matching on task strings |
| Time + action budgets | Configurable expiration and action limits |
| Credential isolation | Passwords stay in AnchorBrowser's isolated session |
| Session destruction | `leash.yank()` destroys the cloud browser session |
| Audit trail | Every task request (allowed + blocked) logged to JSONL |
| Unicode bypass protection | Strips zero-width chars, combining marks, BiDi controls |

### What leashed does NOT enforce

| Layer | Why |
|-------|-----|
| Browser action validation | AnchorBrowser executes tasks autonomously — leashed gates the request, not the execution |
| URL/domain restrictions | Requires AnchorBrowser session-level allowlists (roadmap) |
| Semantic equivalence | `"forward email"` and `"send email to myself"` are different strings — patterns match literally |

**The honest version:** leashed is a seatbelt, not a cage. It stops the 95% of accidents from misconfiguration, scope creep, and unintended actions. A deliberately adversarial agent that lies about what it's doing can bypass pattern matching. For defense-in-depth, see [SECURITY.md](./SECURITY.md).

## CLI

```bash
npx leashed status   # Agent: my-sales-bot | Allowed: 23 | Blocked: 3
npx leashed audit    # Full audit trail
npx leashed yank     # Kill switch — destroy session immediately
```

## API

[Full API reference, policy examples, and audit log format →](./docs/API.md)

## Development

```bash
git clone https://github.com/dormstern/leashed.git
cd leashed
npm install
npm run build
npm test
```

Tests run against mocked AnchorBrowser sessions — no API key needed for development. CI runs on Node 18, 20, and 22.

## Roadmap

### v0.3 — Output Scanning (current)
- Post-execution validation: scan AnchorBrowser output for policy-violating content
- Domain hints in policy for audit enrichment
- Structured output schemas

### v1.0 — Session-Level Enforcement
- URL allowlists enforced at the browser level
- Browser action audit trail (clicks, form fills, navigation)
- Webhook callbacks for real-time policy violation alerts

[Open an issue](https://github.com/dormstern/leashed/issues) or see [CONTRIBUTING.md](./CONTRIBUTING.md) to help shape v1.0.

## Empowered by AnchorBrowser

leashed runs on [AnchorBrowser](https://anchorbrowser.io) — ephemeral, hardened cloud browser sessions for AI agents. SOC2 Type 2, ISO27001 certified. Trusted by Google, Coinbase, and Groq.

AnchorBrowser handles the browser. leashed handles the rules.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, coding standards, and how to submit changes.

## License

MIT
