# CLI Reference

Complete list of logscope commands, flags, and configuration.

If you installed with `npm install -g logscope`, use `logscope …`.
If you're using it without installing, prefix with `npx`, e.g. `npx logscope …`.

---

## Commands

### `logscope [dir]`  (default — alias: `watch`)

Watch a folder, serve the web UI + API, and open your browser.

```bash
logscope                    # watch the current folder
logscope ~/Downloads        # watch a specific folder
logscope watch ~/Downloads  # identical (explicit alias)
```

New files dropped into the watched folder appear in the UI live, with no refresh.

**Options:**
| Flag | Default | Meaning |
|------|---------|---------|
| `-p, --port <number>` | `4477` | Port to bind on `127.0.0.1` |
| `--no-open` | (opens) | Start the server but don't launch the browser |

---

### `logscope ui`  (alias: `app`)

Just launch the web UI. No folder is watched and no path argument is accepted — the
session starts empty and you add logs by dropping them onto the window (or using the
file picker). Dropped files are held in memory only; nothing is read from or written
to disk.

```bash
logscope ui                 # open the UI, watch nothing
logscope ui -p 5000         # on a different port
logscope ui --no-open       # start the server without launching the browser
```

**Options:**
| Flag | Default | Meaning |
|------|---------|---------|
| `-p, --port <number>` | `4477` | Port to bind on `127.0.0.1` |
| `--no-open` | (opens) | Start the server but don't launch the browser |

The `dir` key in `~/.logscope.json` is ignored by this command; `port` and `open` still
apply.

---

### `logscope open <file>`

Open a single log file directly (still serves the UI).

```bash
logscope open export.json
logscope open ./logs/run-2026-08-26.ndjson
```

Accepts the same `--port` / `--no-open` flags as above.

---

### `logscope scan <path>`

Parse a file or folder and print a **trace summary to the terminal** — no browser, no
UI. Useful for a quick look or for automation.

```bash
logscope scan ./logs
logscope scan export.json
```

**Options:**
| Flag | Meaning |
|------|---------|
| `--json` | Emit machine-readable JSON and **exit non-zero if any errors are present** (CI mode) |

**CI example** — fail a pipeline when the logs contain errors:

```bash
logscope scan ./logs --json
# exit code 0 = clean, non-zero = errors found
```

---

### `logscope report <path>`

Write a self-contained, **PII-redacted HTML evidence bundle** — the same artifact the
UI's "Evidence bundle" button produces, but from the command line.

```bash
logscope report ./logs
logscope report ./logs --out evidence.html --title "Defect 1234"
```

**Options:**
| Flag | Default | Meaning |
|------|---------|---------|
| `-o, --out <file>` | `evidence.html` | Output file path |
| `--no-redact` | (redacts) | Export **without** PII redaction |
| `--title <title>` | — | Title shown in the bundle |

---

## Global flags

| Flag | Meaning |
|------|---------|
| `--version` | Print the installed version |
| `--help` | Show help (works per command too, e.g. `logscope scan --help`) |

---

## Configuration file — `~/.logscope.json`

Set your own defaults so you don't retype flags. Create a file named `.logscope.json`
in your home folder:

```json
{
  "port": 4477,
  "dir": ".",
  "open": true
}
```

| Key | Type | Meaning |
|-----|------|---------|
| `port` | number | Default port |
| `dir` | string | Default folder to watch |
| `open` | boolean | Whether to auto-open the browser |

Command-line flags always override the config file. `--no-open` always wins over
`"open": true`.

---

## Running from the source repo (for contributors)

If you're working inside the cloned repository rather than an installed package, use
the npm scripts (note the `--` before logscope arguments):

```bash
npm run cli                       # runs the default serve command from source
npm run cli -- watch ~/Downloads  # pass arguments through
npm run cli -- scan ./logs --json
```

See the [Development](./development.md) guide for the full script list.
