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
