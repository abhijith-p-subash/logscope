# User Guide

How to actually *use* logscope once it's open in your browser. No coding involved —
this is all point-and-click.

The core idea: CloudWatch mixes dozens of requests together and shreds big JSON
objects across many lines. logscope's job is to give you back **one readable story
per request** — this is called a **trace**.

---

## The layout

```
┌────────────────────────────────────────────────────────────┐
│  Header — brand · ◧ Files · theme · layout controls          │
├────────────────────────────────────────────────────────────┤
│  File tabs — one coloured tab per file · Merged · Merge all   │
├────────────────────────────────────────────────────────────┤
│  Density ribbon — the strip showing events over time         │
├────────────────────────────────────────────────────────────┤
│  Toolbar — search · level pills · timezone · sort · export    │
│  Active filter chips                                          │
├──────────┬─────────────────────────────────────────────────┤
│ Sidebar  │  Log table (the rows)                             │
│ requests │                                        ┌────────┐ │
│ & errors │                                        │ legend │ │
│          │                                        └────────┘ │
├──────────┴─────────────────────────────────────────────────┤
│  Detail panel (opens when you click a row)                   │
├────────────────────────────────────────────────────────────┤
│  Status bar — counts · connection · ? shortcuts              │
└────────────────────────────────────────────────────────────┘
```

Press **`?`** at any time for the full keyboard-shortcut and search-syntax cheat sheet.

---

## Loading files

Three ways to get logs in:

1. **Drop them in the watched folder** — they appear automatically (live), no refresh.
2. **Drag-and-drop** files straight onto the logscope page.
3. Click **◧ Files** in the header → **⊕ Add files** → pick files.

In the **Files** panel you can:
- **Double-click a file** to open it in its own tab.
- **Rename** a file's display label (the ✎ button) — cosmetic only, your real file is untouched.
- **Remove** a file from the session (asks for confirmation first).
- Watch an **upload progress bar** and a "ready" ✓ when a file finishes loading.

---

## Working with multiple files: tabs & merging

Each file gets its own **coloured tab**. Click a tab to see just that file.

- **Merged tab** — shows several files **interleaved by timestamp**, so you can debug
  across multiple Lambdas/services at once.
- Every row in the merged view is **colour-coded** by its source file, with a coloured
  bar down the left edge.
- A small **floating legend** (bottom-right) maps each colour to its file name and
  event count. It's translucent until you hover it, and you can collapse or hide it so
  it never covers your logs.
- **Add to / remove from merged:** right-click a tab, or use **Merge all / Unmerge all.**
- **Reorder tabs** by dragging them, like browser tabs.
- **Close a tab** with its `×` — the file stays in the Files panel; double-click it there to reopen.

By default files are **not** merged — you merge only when you want to compare.

---

## Reading a single request (a trace)

This is the whole point of the tool.

1. Open the **Sidebar** (left). It lists every **Request** (correlation id) found,
   with how many events each has.
2. **Click a request** to isolate it — the table now shows only that request's events,
   in order, start to finish.
3. Click **any row** to open the **Detail panel** with the full, re-assembled JSON.

Correlation ids are detected automatically (`@requestId`, `request_id`, `trace_id`,
and similar). For AWS Lambda, `@requestId` is added by CloudWatch for free, so this
usually "just works."

---

## Fragmented (pretty-printed) logs

When code logs pretty-printed JSON, CloudWatch splits it into one event per line — a
40-line object becomes 40 rows. logscope **stitches these back together** and shows a
small **rejoin count** (e.g. `12×`) on the row so you can see where it happened.

> If two genuinely different events landed in the same millisecond they can merge by
> mistake — the rejoin count is how you'd spot that. This is a known limitation of
> reconstructing from already-emitted logs.

---

## Searching

Click the search box (or press `/`). The search is powerful but forgiving:

| You type | It means |
|----------|----------|
| `payment declined` | rows containing **both** words |
| `"connection refused"` | that **exact phrase** |
| `-timeout` | **exclude** rows with "timeout" |
| `timeout \| refused` | **either** one (OR) |
| `/E\d{3}/` | a **regular expression** (a bad regex safely falls back to plain text) |
| `level:error` | scope to a **field** (level, file, rid, msg…) |
| `status:500` | search a **value inside the JSON** payload |
| `file:orders.json` | only one source file |

Matches are **highlighted**, the box shows a **live match count**, and the **`?`
button** next to it lists this syntax with click-to-insert examples.

---

## Filtering & the density ribbon

- **Level pills** (Error / Warn / Info / Debug) — click to toggle; each shows a count.
- **Density ribbon** (the strip up top): grey = everything loaded, the accent colour =
  what your current filters match, **red ticks = errors**. **Drag across it** to filter
  to a time range. Hover it to see the exact time under your cursor.
- **Active filters** appear as removable **chips** — click a chip's `×` to drop just
  that filter, or **Clear all**.
- **Sort** by time, severity, or gap size.
- **Timezone switcher**: IST 12h/24h, your local time, UTC, or "relative to trace
  start." The detail panel always shows **both IST and UTC** so you can quote a UTC
  time to another team without doing the math.

---

## Advanced views (for deeper analysis)

Switch views with the tabs above the table:

- **Waterfall** — a trace drawn as a timeline with a bar per step. Instantly answers
  "where did the 8 seconds go" — the biggest gap is auto-highlighted.
- **Run diff** — pick two requests and compare them side-by-side, aligned by step, with
  field-level differences. The fastest way to compare a passing run to a failing one.
- **Golden path** — learns the "normal" shape across all your traces and flags the ones
  that deviate (missing steps, extra steps, odd ordering).
- **Error clustering** — groups errors by normalized signature, so "the same error, 47
  times" collapses to one line with a count.
- **Concurrency lens** — a chart of how many requests were in flight over time.
- **Agent tree** — for LLM-agent pipelines, renders iteration → tool call → result as a
  nested tree and flags repeated identical tool calls.

---

## Exporting evidence (for defect tickets)

Instead of screenshotting fragmented logs, use **Export** in the toolbar:

- **Evidence bundle (PII redacted)** — a single self-contained HTML file with the full
  reconstructed trace, dual IST/UTC timestamps, source files, the active filter, and the
  error highlighted. It opens in any browser with nothing installed. **PII is redacted by
  default** (emails, long digit sequences, common id fields).
- **Share view (as-is)** — the current filtered view as a self-contained HTML file to
  hand a colleague.
- **Events as JSON** — the raw filtered events.

---

## Keyboard shortcuts

Press **`?`** for the in-app list. The essentials:

| Key | Action |
|-----|--------|
| `/` | focus the search box |
| `j` / `k` | move down / up a row |
| `e` | expand the selected row |
| `g` / `G` | jump to the first / last row |
| `Esc` | close the detail panel / clear focus |
| `?` | open this shortcut & search-syntax help |

---

## Privacy, at a glance

- Runs **entirely on your machine**; works with the network off.
- **Nothing is saved to disk** except the export files *you* explicitly create.
- Your log folder is **read-only** to logscope — it never changes your files.
- The server is reachable **only from your own computer** (`127.0.0.1`).

Next: **[CLI Reference](./cli-reference.md)** · **[Troubleshooting](./troubleshooting.md)**
