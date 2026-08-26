# Security Policy

## Supported versions

logscope is pre-1.0. Fixes land on the latest published version; there are no
backports.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ |
| < 0.1   | ❌ |

## Reporting a vulnerability

Please report privately through
[GitHub Security Advisories](https://github.com/abhijith-p-subash/logscope/security/advisories/new),
or by email to abhijith.p.subash@gmail.com if you'd rather not use GitHub.

**Please don't open a public issue for a vulnerability.**

Include what you'd want to receive: what the flaw is, how to reproduce it, and
what an attacker gets out of it. A proof of concept helps. Expect an
acknowledgement within a week; if the report is valid you'll be credited in the
advisory unless you'd prefer not to be.

## What counts as a vulnerability here

logscope's threat model is unusual, so it's worth being specific. The tool is
built to be pointed at log exports containing client PII, on a laptop, offline.
Its guarantees are the security surface:

**In scope — these are the things worth reporting:**

- **Network egress.** Any code path that sends data anywhere — telemetry, an
  update check, a CDN font, an AWS call, a DNS lookup. There should be none.
- **Data written to disk.** Log content must never be persisted. The only writes
  are the explicit `report` / evidence-bundle exports the user asks for.
- **A non-loopback bind.** The server must only ever listen on `127.0.0.1`. A
  path that reaches `0.0.0.0` would expose an unauthenticated log viewer to the
  local network.
- **Path traversal** in the static file server or any file-reading code path.
- **Redaction failures** — PII that survives into an evidence bundle generated
  with redaction enabled.
- **XSS in the UI or in an evidence bundle**, particularly via crafted log
  content, since bundles get attached to tickets and opened by other people.
- **A crash on malformed input** that takes the process down rather than
  degrading to raw text with a warning.

**Out of scope:**

- Anything requiring an attacker who already has local access to the machine and
  the log files themselves. If they can read `~/Downloads`, logscope isn't the
  weak link.
- The absence of authentication on the local server. That's deliberate: it binds
  to loopback only, which is what makes it unreachable. A *failure* of that
  binding is in scope; the design isn't.
- Denial of service by feeding it an enormous file. Memory limits are a known
  trade-off — everything is held in memory on purpose, and the UI warns past
  512 MB.
- Vulnerabilities in dev dependencies that never ship. The published tarball
  contains exactly two runtime dependencies (`commander`, `chokidar`).
