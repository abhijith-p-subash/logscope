# Verifying logscope (Phases 1–6)

This guide walks you through checking that everything works on your machine: the
pure engine (`core/`), the CLI (`scan` / `report`), the `serve` server + folder
watcher, the full React web UI (Tier-1 + Tier-2 features), and packaging.

Estimated time: ~12 minutes.

---

## 0. Prerequisites

| Need | Check | Expected |
|------|-------|----------|
| Node 22.6+ | `node -v` | `v22.6` or higher — the dev scripts run TypeScript directly |
| npm | `npm -v` | any recent version |

If `node -v` prints nothing or an older version, install Node 22 LTS or newer
before continuing. (End users only need Node 20+ — the stricter floor applies to
running this repo from source.)

---

## 1. One-time setup

Run these once from the project root (your clone of the repository).

```bash
npm install
npm run gen:fixtures
npm run build:web
```

- `npm install` pulls dependencies. Only **2 are runtime** (`commander`,
  `chokidar`); everything else (React, Vite, Tailwind, fonts, TypeScript,
  Vitest, Playwright) is a **devDependency** used to build or test — none ship in
  the runtime dependency surface a security reviewer audits.
- `npm run gen:fixtures` writes `testdata/perf-100k.ndjson` — a 100,000-row file
  used by the performance test. It is gitignored (too big to commit).
- `npm run build:web` compiles the React UI to `dist/web` (also gitignored). The
  `serve` command serves this build; without it you get a minimal fallback page.

> **About the `npm audit` warnings:** they all come from `vitest → vite →
> esbuild` and are **dev-only** (a dev-server advisory). Nothing shipped or run
> in production is affected, and the two runtime dependencies are clean. Safe to
> ignore for now.

---

## 2. Automated checks (the important ones)

### 2a. Run the test suite

```bash
npm test
```

**Expected:** all tests pass — currently **120 passing across 12 files**, ending with:

```
 Test Files  12 passed (12)
      Tests  120 passed (120)
```

This is the real proof the engine is correct. Among the 90 tests, these map
directly to the spec's known-bug list:

| What it proves | Where |
|----------------|-------|
| Fragmented pretty-JSON rejoins with **nested fields intact** | `src/core/stitch.test.ts` |
| Recovery **scans every `{`/`[`** (doesn't cut at a bracketed prefix) | `src/core/stitch.test.ts` |
| **Reversed-order** fragments recover (Insights newest-first) | `src/core/stitch.test.ts` |
| **12-hour midnight = `12:00:00 AM`** (date rolls forward) and **noon = `12:00:00 PM`** | `src/core/time.test.ts` |
| All timestamp formats (ISO, Python comma-millis, epoch s/ms, no-tz→UTC) | `src/core/time.test.ts` |
| **HTML is escaped before highlighting** (XSS vector) | `src/core/search.test.ts` |
| CSV payload recovered from a quoted cell with escaped `""` | `src/core/parse.test.ts` |
| Insights `results` shape unwrapped | `src/core/parse.test.ts` |
| **10,000-row truncation warning** | `src/core/parse.test.ts` |
| **100k rows parse in < 3s** | `src/core/ingest.test.ts` |
| **Parsers never throw** on truncated/corrupted input (fuzz) | `src/core/ingest.test.ts` |
| CLI `--json` exits non-zero on errors (CI mode) | `src/cli/scan.test.ts` |

### 2b. Type-check

```bash
npm run typecheck
```

**Expected:** no output, exit code 0 (a clean `tsc --noEmit`).

---

## 3. Manual check — the CLI

### 3a. Deterministic single-file check (`--json`)

```bash
npm run cli -- scan ./testdata/fragmented-pretty.json --json
```

**Expected output** (this exact JSON):

```json
{
  "files": [
    { "name": "fragmented-pretty.json", "events": 3, "format": "json", "rejoined": 8, "truncated": false }
  ],
  "summary": { "files": 1, "events": 3, "traces": 1, "errors": 1, "rejoined": 8 },
  "traces": [
    { "rid": "req-abc-123", "events": 3, "start": 1787308162001, "end": 1787308164500, "durationMs": 2499, "errors": 1 }
  ],
  "signatures": [
    { "sig": "tool failed: timeout after 30000ms", "count": 1 }
  ],
  "warnings": []
}
```

The key things to confirm: `"rejoined": 8` (nine fragmented rows collapsed into
one event), one reconstructed trace `req-abc-123`, and one error.

### 3b. Confirm the CI exit code

The `scan --json` above should **exit non-zero** because the file contains an
error. Check it:

- **PowerShell:** run the command, then `echo $LASTEXITCODE` → expect `1`
- **Git Bash / macOS / Linux:** append `; echo $?` → expect `1`

Now run it against a file with no errors and confirm exit `0`:

```bash
npm run cli -- scan ./testdata/events.ndjson --json
```

> Note: `events.ndjson` **does** contain an error row, so that one also exits 1.
> A file with only info/debug rows exits 0. (This is exactly what the automated
> test `--json exits zero when there are no errors` verifies with a temp file.)

### 3c. Human-readable summary of the whole folder

```bash
npm run cli -- scan ./testdata
```

**Expected:** a formatted report with `FILES`, `TRACES`, `ERROR SIGNATURES`, and
`WARNINGS` sections. Because `testdata/` contains the generated
`perf-100k.ndjson`, you'll see ~100,020 events and 508 traces — a good live
demonstration of 100k-row handling. The `empty.json is empty` warning should
appear at the bottom.

To see a smaller, cleaner report, scan a subset — e.g. copy a few fixtures into a
temp folder, or scan an individual file.

---

## 4. Manual check — the server + live watching (Phase 3)

This is the piece that makes logscope more than a CLI: it watches a folder and
serves a local web view that updates the instant a file appears.

### 4a. Start it

```bash
npm run cli -- serve ./testdata
```

(Or `npm run cli` with no args to watch the current folder, or
`npm run cli -- watch <folder>`.)

**Expected:** it prints something like

```
  logscope serving http://127.0.0.1:4477
  watching …/logscope/testdata
  drop CloudWatch exports into that folder · Ctrl-C to stop

  ready · 10 files · 100020 events · 508 traces
```

Note it binds **`127.0.0.1` only** — not reachable from the network, which is
why no login is needed (constraint 5).

### 4b. Open the browser

Go to **http://127.0.0.1:4477**. If you ran `npm run build:web`, you'll see the
full dark **lab-instrument UI** (Phase 4): the density ribbon on top, a request
sidebar, level pills, and the virtualized log table. (Without a build, you get a
minimal fallback status page instead.) It uses only self-hosted fonts — no CDN.

### 4c. Watch it update live

With the server running, in a second terminal drop a file into the watched
folder — for example:

```bash
cp testdata/clean-json.json /tmp/whatever   # any copy INTO the watched folder
```

On Windows PowerShell, just copy any supported file into `testdata\`. The browser
page and the server log update **within a second, no refresh** — you'll see
`→ loaded <file>` in the server terminal. Delete the file and it shows
`→ removed <file>` and the counts drop.

Re-copying the **same** file is a no-op (content-hash dedupe) — no `reloaded`
line appears. That's re-downloading an export being correctly ignored.

### 4d. Check the API directly (optional)

```bash
curl http://127.0.0.1:4477/api/summary     # counts + file list
curl http://127.0.0.1:4477/api/session     # full events + traces + signatures
```

Stop the server with **Ctrl-C**.

> All of the above is also covered by the automated integration test
> `src/server/server.test.ts` (loopback bind, live file drop, JSON API, SSE
> stream, and the no-external-resources check).

### 4e. Exercise the Tier-1 UI features (Phase 4)

With the UI open (and ideally serving `./testdata` so there's plenty to click),
try each of these — this is the full Tier-1 feature set:

- **Trace reconstruction** — click a request id in the left sidebar; the table
  isolates just that request. This is the feature the product exists for.
- **Density ribbon** — the canvas strip on top: grey = all loaded, cyan = current
  filter matches, red ticks = errors. **Drag across it** to filter by time; a
  “Clear range” button appears.
- **Search** — type in the search box. Try `-term` to exclude, `"a phrase"` for a
  literal, and `/error|fail/` for regex. Matches highlight in the message column.
- **Level pills** — click `error` / `warn` / `info` / `debug` to filter; counts
  show per level. They compose with search and the request filter.
- **Sort** — click the `Level`, `Timestamp`, or `+Gap` column headers, or use the
  sort dropdown (time, severity, gap size).
- **Timezone switcher** — dropdown: IST 12h / IST 24h / Local / UTC / Relative.
  The detail panel always shows IST **and** UTC together.
- **Detail view** — click any row: a collapsible, syntax-highlighted JSON tree
  opens. Click a key to copy its path, a value to copy it. “Trace request”
  filters to that row’s request.
- **Fragment rejoin count** — rows stitched from multiple CloudWatch lines show a
  cyan `N×` badge (open `fragmented-pretty.json` to see it).
- **Keyboard nav** — `/` focus search, `j`/`k` move, `e` expand, `g`/`G` jump to
  ends, `Esc` close.
- **Live update** — drop a file into the watched folder; new rows appear without a
  refresh (green “● live” in the status bar).
- **Drag-and-drop** — drag a `.json`/`.ndjson`/`.csv`/`.log` file onto the window
  to ingest it in memory (it is **not** written to disk).
- **Export** — the Export button downloads the current filtered view as JSON with
  dual IST/UTC timestamps. (Full PII-redacted evidence bundles are Phase 5.)
- **Theme** — the Light/Dark toggle, top-right.

**Performance:** serve `./testdata` (which includes the 100k-row file) and scroll
the table — it should stay smooth (virtualized rendering), and searching/filtering
should feel instant.

#### Automated UI smoke test

There's one Playwright smoke test (per the spec). After a one-time browser
install:

```bash
npx playwright install chromium   # one-time, needs network
npm run test:e2e
```

It builds the UI, starts a real server against `web/e2e/logs`, and checks that
rows render, the ribbon and sidebar show, a row opens the detail panel, search
filters to the empty state, and the error pill narrows to error rows.

---

## 5. Tier-2 features & packaging (Phases 5–6)

### 5a. Trace-analysis views (Phase 5)

With the UI open on `./testdata`, use the **view tabs** above the log table:

- **Waterfall** — click a request in the sidebar first, then this tab. Each step
  is a bar on a timeline; the **widest bar (amber)** is where the time went.
- **Agent tree** — for requests with `[ITER-n]` / `[TOOL_CALL:…]` markers, shows
  iteration → tool → result nesting; repeated identical tool calls are flagged.
- **Run diff** — pick two requests (A/B dropdowns); shared steps align, and
  steps present in only one, plus field-level payload changes, are highlighted.
- **Golden path** — the modal trace shape, and every request that deviates
  (missing / extra / reordered steps). Click one to jump to its waterfall.
- **Concurrency** — an area chart of how many requests were in flight over time,
  with the peak labelled.

**Export menu** (top-right `Export ▾`):
- **Evidence bundle (PII redacted)** — downloads a self-contained HTML defect
  artifact with dual IST/UTC timestamps; emails and long id numbers are redacted.
- **Share view (as-is)** — same, without redaction.
- **Events as JSON**.

### 5b. Evidence bundle from the CLI (Phase 5)

```bash
npm run cli -- report ./testdata/clean-json.json --out evidence.html
```

Open `evidence.html` in any browser — it's fully self-contained (no network).
It should print `… (PII redacted)`. Use `--no-redact` to skip redaction.

### 5c. Packaging (Phase 6)

```bash
npm run build          # builds dist/web (UI) and dist/cli (bundled CLI)
npm pack --dry-run     # shows exactly what would publish: dist/, package.json, README
```

The tarball contains only `dist/` and `README.md` — no `src`, `node_modules`, or
fixtures. To try the real global install from this repo:

```bash
npm pack                       # produces logscope-cli-0.1.0.tgz
npm i -g ./logscope-cli-0.1.0.tgz  # installs the `logscope` binary
logscope scan ./testdata       # run the installed binary
npm rm -g logscope             # clean up
```

`logscope` (no args) opens the browser automatically; pass `--no-open` to skip,
or set `{ "open": false }` in `~/.logscope.json` (also honours `port` and `dir`).

---

## 6. Security-constraint spot check (optional but worth it)

Constraint 1 of the project is **zero network egress**. Nothing built so far
makes a network call. You can prove it:

1. Disconnect from the network (turn off Wi-Fi / pull the cable).
2. Re-run `npm run cli -- scan ./testdata`.

It should work identically offline. (`npm install` needs the network; running
does not.)

---

## 7. What to do from your end

### Right now
- [ ] Run sections 2, 3, and 4 above and confirm the expected results.
- [ ] Open the UI (section 4b/4e) and click through the Tier-1 features.
- [ ] **Commit** the work if you're happy with it (you said you handle git). The
      uncommitted tree currently holds the Phase 1–4 code, tests, fixtures, and
      config.
- [ ] Decide whether I should proceed to **Phase 5 (Tier-2 features: waterfall,
      run diff, golden path, evidence bundles, PII redaction, …)**.

### Org / decision questions (these are yours to answer, not code)
These don't block development but determine how the tool ships:
- [ ] **Do QA testers have Node 20+**, or only developers? (Decides whether the
      standalone-binary escape hatch is needed. QA is ~half the user base.)
- [ ] **Does the corporate npm registry proxy public npm?** (If blocked,
      `npx logscope-cli` / `npm i -g` won't work and we fall back to a tarball.)
- [ ] **Do we control the agent services' logging code?** (Decides whether
      fixing the log emitter is a PR or a cross-team negotiation.)
- [ ] Do the XML export files mentioned in D8 actually exist? (If not, no XML
      parser gets built.)
- [ ] Baseline: **how long does a defect currently take to reproduce/document?**
      Measure before the tool ships, or its value can't be demonstrated later.

### Nice to have (for later phases)
- [ ] A few **real (sanitized) CloudWatch exports** dropped into `testdata/`.
      Real data always surfaces edge cases the synthetic fixtures miss — and the
      working style is to add a fixture *before* fixing any bug it reveals.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm run gen:fixtures` errors on `--experimental-strip-types` | You're on Node < 22.6. Upgrade Node, or ignore — only the 100k perf test needs it. |
| Performance test is slow/fails on first run | First run includes TypeScript transform + fixture generation; re-run `npm test`. |
| CLI prints raw ANSI codes into a file | Expected — colour auto-disables for non-TTY; set `NO_COLOR=1` to be sure. |
| `Path not found` from `scan` | Check the path is relative to where you're running the command (the project root). |
