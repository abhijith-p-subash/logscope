# testdata

Fixture export files exercising every parser path and edge case. Add a real
log shape here *before* fixing any bug it exposes (see CLAUDE.md working style).

| File | Shape | Exercises |
|------|-------|-----------|
| `fragmented-pretty.json` | CloudWatch JSON array, pretty-printed object split across rows | Stitching, scan-every-opener (bracketed prefix), nested fields intact, rejoin count |
| `clean-json.json` | CloudWatch JSON array, single-line payloads | Baseline JSON parse + correlation |
| `events.ndjson` | One JSON object per line | NDJSON detection |
| `export.csv` | CloudWatch CSV, JSON payload in a quoted cell | CSV parse, escaped `""`, re-parse of message cell, `@requestId` column |
| `insights-results.json` | Insights `results` field/value shape | Insights unwrap, space-separated (no-tz, assume-UTC) timestamps |
| `reversed-order.json` | Fragments stored newest-first (Insights order) | Reversed-join retry when forward parse fails |
| `no-timestamps.json` | Objects with no timestamp field | Fallback to one-event-per-row, `hasTime=false` |
| `agent-pipeline.json` | LLM-agent logs with `[ITER-n]` / `[TOOL_CALL/RESULT/OUTPUT]` markers | Agent iteration tree, repeated-tool-call detection |
| `malformed.txt` | Corrupted / non-JSON text | Degrade to raw text, never throw |
| `empty.json` | Zero bytes | Empty-file handling |
| `perf-100k.ndjson` | 100k rows (generated, gitignored) | Performance target (parse < 3s). Run `npm run gen:fixtures` |

The CloudWatch Insights 10,000-row truncation warning is covered by a
programmatic test rather than a committed 10k-row fixture.
