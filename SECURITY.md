# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in `leashed`, **please do not file a public issue.**

Email: **dormstern@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Impact assessment (what can an attacker do?)

We will acknowledge receipt within 48 hours and aim to release a fix within 7 days for critical issues.

## Scope

`leashed` is responsible for:
- Policy evaluation (deny/allow pattern matching)
- Audit log integrity (append-only JSONL)
- Session lifecycle (create, kill, budget enforcement)
- Input sanitization (Unicode bypass protection)

`leashed` is **not** responsible for:
- AnchorBrowser SDK security (report to [AnchorBrowser](https://anchorbrowser.io))
- Semantic prompt injection (glob patterns are a coarse filter, not a semantic security boundary)
- Credential storage (API keys are your responsibility)

## Known Limitations

- Glob pattern matching operates on the literal task string. It cannot detect semantic equivalents (e.g., "forward" vs "send").
- The audit log is a local file. For tamper-proof logging, export to an immutable store (S3 with object lock, a database, or syslog).
- The expire timer and kill switch are best-effort — an in-flight AnchorBrowser task may complete after the kill signal.

## Trust Model

leashed operates at the **intent layer** — it evaluates task description strings before forwarding to AnchorBrowser. It does NOT have visibility into browser-level execution.

### Threat model

| Threat | Mitigated? | Notes |
|--------|-----------|-------|
| Accidental scope creep (agent uses descriptive task names) | Yes | Policy gating blocks unintended categories |
| Credential exposure to agent code | Yes | Credentials stay in AnchorBrowser's isolated session |
| Unlimited session duration | Yes | Time-based expiration + action budgets |
| Session left running after use | Yes | `leash.yank()` + CLI `npx leashed yank` |
| Unicode obfuscation of task strings | Yes | sanitizeTask() strips invisible characters |
| Deliberately adversarial task labeling | Partially | Pattern matching is literal, not semantic |
| Direct AnchorBrowser API bypass | No | Agent with API key can skip leashed entirely |
| In-browser action divergence | No | AnchorBrowser AI executes autonomously |
| Prompt injection via web content | No | AnchorBrowser's responsibility — report to them |

### Defense-in-depth recommendations

1. Use `default: deny` and explicit allow lists
2. Keep `max_actions` low — budget limits blast radius even if patterns are bypassed
3. Use `expire_after` — session auto-kills limit exposure window
4. Review audit logs regularly — `npx leashed audit` or export JSONL to your SIEM
5. For production: complement leashed with AnchorBrowser's own session monitoring
