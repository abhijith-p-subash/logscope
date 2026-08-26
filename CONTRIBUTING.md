# Contributing to logscope

Thanks for taking a look. Bug reports, docs fixes, and small focused PRs are all
welcome.

## Before you start

logscope has six [hard constraints](./docs/development.md#non-negotiable-constraints).
They aren't preferences — they're why the tool is safe to point at logs full of
client PII:

1. **Zero network egress at runtime** — every asset is self-hosted; it works offline.
2. **No persistence** — everything lives in memory; the only disk writes are explicit exports.
3. **Minimal dependency surface** — four or fewer direct runtime dependencies.
4. **Read-only** on the watched folder.
5. **Loopback only** — bind `127.0.0.1`, never `0.0.0.0`.
6. **Never crash on malformed input** — degrade to raw text with a visible warning.

A change that weakens one of these needs a strong case in the PR description. If
you're unsure whether an idea fits, open an issue first — it's cheaper than
writing the code twice.

## Setup

```bash
git clone https://github.com/abhijithpsubash/logscope.git
cd logscope
npm install
npm test
```

**Node 22.6+ is needed to develop**, even though the published package runs on
Node 20+. The dev scripts execute TypeScript directly via
`--experimental-strip-types`, which older versions don't have. `.nvmrc` pins a
suitable version — `nvm use` picks it up.

## The loop

```bash
npm run cli -- scan testdata           # run the CLI from source
npm run cli -- ui                      # the web UI, watching nothing
npm run dev:web                        # Vite dev server with hot reload
npm test -- --watch                    # tests as you type
```

`testdata/` holds deliberately awkward fixtures — fragmented pretty-printed JSON,
malformed rows, missing timestamps, reversed order. New parsing behaviour should
come with a fixture that captures the shape of input that motivated it.

## Before you open a PR

```bash
npm run typecheck && npm run typecheck:web && npm test && npm run build
```

E2E is a single Chromium smoke test. It needs browsers downloaded once:

```bash
npx playwright install chromium
npm run test:e2e
```

CI runs all of this on Node 20, 22, and 24, plus a job that packs the tarball,
installs it into a clean project, and runs the binary.

## House style

- **Match the file you're editing.** Comment density, naming, and structure are
  consistent across the codebase; new code should be indistinguishable from what
  surrounds it.
- **Comments explain why, not what.** The existing ones note the constraint or
  the trade-off behind a decision — that's the bar.
- **No new runtime dependencies** without a conversation. Dev dependencies are
  cheap (they never ship); runtime ones are audited by the people who adopt this
  at work.
- **Types are strict.** No `any`, no non-null `!` assertions to silence the
  compiler.

## Layout

| Path | What lives there |
|------|------------------|
| `src/core/` | Pure engine — parse, stitch, correlate, search, redact, report. No I/O. |
| `src/server/` | HTTP server, SSE, in-memory store, folder watcher. |
| `src/cli/` | Commander wiring and the terminal renderers. |
| `web/src/` | React UI. |
| `testdata/` | Fixtures, including the deliberately broken ones. |
| `docs/` | User and contributor documentation (ships in the npm tarball). |

`src/core/` is pure and has no imports from `server/` or `cli/`. Keep it that
way — it's what makes the engine testable without touching a filesystem.

## Reporting bugs

Use the [issue templates](https://github.com/abhijithpsubash/logscope/issues/new/choose).
**Please redact log content before pasting it.** If a bug needs a real-looking
export to reproduce, replace the identifiers and values first — a fixture with
the shape intact and the data replaced is just as useful.

Security issues go through
[private advisories](https://github.com/abhijithpsubash/logscope/security/advisories/new),
not public issues. See [SECURITY.md](./SECURITY.md).

## Licence

Contributions are accepted under the [MIT Licence](./LICENSE).
