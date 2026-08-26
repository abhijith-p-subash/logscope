# logscope

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
**[Getting Started guide](./docs/getting-started.md)** walks you through it, step by step,
no experience assumed.

---

## Quickstart

```bash
npx logscope                 # watch the current folder and open the browser
```

Or install it and point it at your downloads folder:

```bash
npm install -g logscope
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
`~/.logscope.json`. Full details in the **[CLI Reference](./docs/cli-reference.md)**.

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

See the **[User Guide](./docs/user-guide.md)** for how to use all of it.

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
| **[Getting Started](./docs/getting-started.md)** | First-time setup, including installing Node.js — non-technical friendly |
| **[Exporting logs from CloudWatch](./docs/exporting-logs.md)** | Getting a log file out of AWS + the 10k-row cap |
| **[User Guide](./docs/user-guide.md)** | Using the app: traces, search, filters, analysis views, exports |
| **[CLI Reference](./docs/cli-reference.md)** | Every command, flag, and the config file |
| **[Troubleshooting & FAQ](./docs/troubleshooting.md)** | Fixes for the common problems |
| **[Development](./docs/development.md)** | Contributing, scripts, publishing |

---

## Requirements

Node.js 20 or newer. Nothing else.

## License

[MIT](./LICENSE) © 2026 Abhijith P Subash. Use it, fork it, ship it.

---

A manual verification walkthrough lives in `VERIFY.md`.
