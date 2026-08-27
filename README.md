<p align="center">
  <img src="https://raw.githubusercontent.com/abhijith-p-subash/logscope/master/.github/assets/banner.svg"
       alt="logscope — offline log analysis for AWS CloudWatch exports" width="840">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/logscope-cli"><img alt="npm version" src="https://img.shields.io/npm/v/logscope-cli.svg?cacheSeconds=3600"></a>
  <a href="https://github.com/abhijith-p-subash/logscope/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/abhijith-p-subash/logscope/actions/workflows/ci.yml/badge.svg?branch=master"></a>
  <a href="https://nodejs.org"><img alt="node" src="https://img.shields.io/node/v/logscope-cli.svg?cacheSeconds=3600"></a>
  <a href="https://github.com/abhijith-p-subash/logscope/blob/master/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/logscope-cli.svg?cacheSeconds=3600"></a>
  <a href="https://github.com/abhijith-p-subash/logscope/blob/master/package.json"><img alt="runtime dependencies" src="https://img.shields.io/badge/runtime%20deps-2-brightgreen.svg"></a>
</p>

**Offline log analysis for AWS CloudWatch exports.** It reassembles fragmented events,
reconstructs concurrent requests into readable traces, and serves a local web UI — all
on your own machine, with the network disconnected.

> CloudWatch shreds pretty-printed JSON across dozens of lines and interleaves dozens of
> concurrent requests into one stream. logscope gives you back **one readable story per
> request**, so you can actually follow what happened.

---

## Prerequisite

**[Node.js](https://nodejs.org) version 20 or newer** — this is the only thing you need
to install. Check with `node --version`. New to this? The
**[Getting Started guide](https://github.com/abhijith-p-subash/logscope/blob/master/docs/getting-started.md)** walks you through it, step by step,
no experience assumed.

---

## Quickstart

```bash
npx logscope-cli                 # watch the current folder and open the browser
```

Or install it and point it at your downloads folder:

```bash
npm install -g logscope-cli
logscope ~/Downloads         # new exports appear live as you download them
```

Then drop a CloudWatch export (`.json`, `.ndjson`, `.csv`, `.txt`, or `.log`) into that
folder — it shows up in your browser instantly. Stop logscope with `Ctrl + C`.

---

## Commands

```bash
logscope                     # watch ./ , serve the UI, open the browser (alias: watch)
logscope ui                  # just launch the web UI — no folder watched (alias: app)
logscope watch ~/Downloads   # watch a specific folder
logscope open export.json    # open a single file directly
logscope scan ./logs         # terminal trace summary, no UI
logscope scan ./logs --json  # machine-readable; exits non-zero on errors (CI mode)
logscope report ./logs --out evidence.html   # PII-redacted HTML evidence bundle
```

Flags: `-p, --port <n>` (default `4477`), `--no-open`. Defaults can live in
`~/.logscope.json`. Full details in the **[CLI Reference](https://github.com/abhijith-p-subash/logscope/blob/master/docs/cli-reference.md)**.

---

## What it does

- **Reassembles fragmented events.** Pretty-printed JSON (`json.dumps(obj, indent=2)`)
  gets shredded into one CloudWatch event per line. logscope stitches those rows back
  into the original object and shows a rejoin count.
- **Reconstructs traces.** Dozens of concurrent invocations interleave in one log group.
  logscope groups events by correlation id (`@requestId`, `trace_id`, …) so you can
  follow one request from start to end.
- **Reads JSON, NDJSON, CSV, and the Insights `results` shape**, auto-detected.
- **Merges multiple files** by timestamp with per-file colour coding — debug several
  Lambdas/services together in one view.
- **Powerful search** — words AND, `"phrases"`, `-exclude`, `a | b`, `/regex/`, and
  `field:value` (including keys inside the JSON payload).
- **Trace waterfall, run diff, golden-path deviation, error clustering, concurrency
  lens, and an agent iteration tree** for LLM-pipeline logs.
- **Evidence bundles** — a self-contained, PII-redacted HTML artifact for a defect
  ticket, replacing screenshots of fragmented logs.

See the **[User Guide](https://github.com/abhijith-p-subash/logscope/blob/master/docs/user-guide.md)** for how to use all of it.

---

## Guarantees

- **Zero network egress.** No telemetry, update checks, CDN fonts, or AWS calls. Fonts
  and assets are self-hosted; it works fully offline (test it with Wi-Fi off).
- **No persistence.** Everything lives in memory and dies with the process. The only disk
  writes are explicit exports you trigger.
- **Read-only.** It never modifies, moves, or deletes anything in the watched folder.
- **Loopback only.** The server binds `127.0.0.1` and is unreachable from the network, so
  it needs no authentication.
- **Two runtime dependencies** (`commander`, `chokidar`). Everything else is build-time only.

These make it safe to run against logs containing client PII, and trivial to security-review.
They are hard constraints, not preferences — see the guarantees above before proposing changes.

---

## Documentation

| Guide | For |
|-------|-----|
| **[Getting Started](https://github.com/abhijith-p-subash/logscope/blob/master/docs/getting-started.md)** | First-time setup, including installing Node.js — non-technical friendly |
| **[Exporting logs from CloudWatch](https://github.com/abhijith-p-subash/logscope/blob/master/docs/exporting-logs.md)** | Getting a log file out of AWS + the 10k-row cap |
| **[User Guide](https://github.com/abhijith-p-subash/logscope/blob/master/docs/user-guide.md)** | Using the app: traces, search, filters, analysis views, exports |
| **[CLI Reference](https://github.com/abhijith-p-subash/logscope/blob/master/docs/cli-reference.md)** | Every command, flag, and the config file |
| **[Troubleshooting & FAQ](https://github.com/abhijith-p-subash/logscope/blob/master/docs/troubleshooting.md)** | Fixes for the common problems |
| **[Development](https://github.com/abhijith-p-subash/logscope/blob/master/docs/development.md)** | Repo setup, scripts, layout, publishing |
| **[Contributing](https://github.com/abhijith-p-subash/logscope/blob/master/CONTRIBUTING.md)** | House style, the PR checklist, what gets merged |
| **[Changelog](https://github.com/abhijith-p-subash/logscope/blob/master/CHANGELOG.md)** | What changed in each release |

---

## Requirements

Node.js 20 or newer. Nothing else.

## Contributing

Bug reports, docs fixes, and focused PRs are welcome — see
**[CONTRIBUTING.md](https://github.com/abhijith-p-subash/logscope/blob/master/CONTRIBUTING.md)** for setup, house style, and the six hard
constraints any change has to respect. Found a security flaw? Please report it
privately: **[SECURITY.md](https://github.com/abhijith-p-subash/logscope/blob/master/SECURITY.md)**.

Everyone interacting with the project is expected to follow the
[Code of Conduct](https://github.com/abhijith-p-subash/logscope/blob/master/CODE_OF_CONDUCT.md).

## License

[MIT](https://github.com/abhijith-p-subash/logscope/blob/master/LICENSE) © 2026 Abhijith P Subash. Use it, fork it, ship it.

---

A manual verification walkthrough lives in [docs/verifying.md](https://github.com/abhijith-p-subash/logscope/blob/master/docs/verifying.md).
