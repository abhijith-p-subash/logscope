# Development

For contributors working inside the cloned repository. End users don't need this —
see [Getting Started](./getting-started.md) instead.

## Prerequisites

- **Node.js 20+** (same as the runtime requirement).
- npm (ships with Node).

## Setup

```bash
git clone <your-repo-url>
cd logscope
npm install
```

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run cli` | Run the CLI from source (`node --experimental-strip-types`). Pass args after `--`. |
| `npm run dev:web` | Vite dev server for the UI with hot reload (proxies `/api` to a running `logscope serve`). |
| `npm run build:web` | Build the UI to `dist/web`. |
| `npm run build:cli` | Compile the CLI to `dist/cli` (tsup). |
| `npm run build` | Build both (UI then CLI). Also runs automatically on `npm publish` via `prepublishOnly`. |
| `npm test` | Unit + integration tests (Vitest). |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run typecheck` | Type-check the engine + server. |
| `npm run typecheck:web` | Type-check the UI. |
| `npm run test:e2e` | One Playwright UI smoke test (needs `npx playwright install chromium`). |
| `npm run gen:fixtures` | Regenerate the large 100k-row performance fixture. |

> After changing UI or engine source, run `npm run build:web` (or `npm run build`) and
> restart `npm run cli` — the served UI is the pre-built `dist/web`, so it won't pick up
> source edits until rebuilt. For live reload while developing the UI, use
> `npm run dev:web`.

## Project layout

```
src/
  core/     pure logic (parse, stitch, correlate, analyze, redact, time) — no I/O
  cli/      commander setup + commands (serve, scan, report)
  server/   http, watcher, in-memory store, SSE
web/        React + Vite UI
testdata/   fixture export files
docs/       this documentation
```

`src/core/` must not import from `src/server/` or `src/cli/`; it takes strings in and
returns data out, which keeps it portable and trivially testable.

## Publishing an npm package

The published tarball is intentionally lean — `dist/`, `docs/`, `README.md`, and
`LICENSE` (see the `files` allowlist in `package.json`; npm always adds the licence).

```bash
npm test               # 135 unit tests
npm run typecheck      # CLI + core
npm run build          # produces dist/web and dist/cli
npm publish --dry-run  # inspect the tarball without publishing
npm publish            # (prepublishOnly rebuilds first)
```

Releasing a new version:

```bash
npm version patch      # or minor / major — commits and tags
git push --follow-tags
npm publish
```

`logscope --version` reads the version straight from `package.json`, so bumping
the package is all that's needed — there is no second place to edit.

## Non-negotiable constraints

These define the project — flag any change that would violate one:

1. **Zero network egress at runtime** (self-host every asset; works offline).
2. **No persistence** — everything in memory; the only disk writes are explicit exports.
3. **Minimal dependency surface** — four or fewer direct runtime dependencies.
4. **Read-only** on the watched folder.
5. **Loopback only** — bind `127.0.0.1`, never `0.0.0.0`.
6. **Never crash on malformed input** — degrade to raw text with a visible warning.

## Read next

- `VERIFY.md` — a full manual verification walkthrough.
