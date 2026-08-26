# Troubleshooting & FAQ

Common problems and quick fixes. Most issues are one of the first three below.

---

## "`node` is not recognized" / "command not found: node"

Node.js isn't installed, or your terminal was open before you installed it.

1. Install Node.js 20+ from **https://nodejs.org** (the **LTS** button).
2. **Close and reopen** your terminal.
3. Run `node --version` — it should print `v20` or higher.

See [Getting Started → Step 1](./getting-started.md#step-1--install-the-one-prerequisite-nodejs).

---

## "`logscope` is not recognized" / "command not found: logscope"

You haven't installed it globally. Either:

- Run it without installing: `npx logscope`, **or**
- Install it: `npm install -g logscope`, then reopen your terminal.

---

## `npx` / `npm install` fails to download (behind a corporate proxy)

Your company network may block the public npm registry.

- Ask whoever shared logscope for your **internal registry URL**, a **tarball** (`.tgz`)
  file, or a **git URL** to install from.
- Install from a tarball like this:
  ```bash
  npm install -g ./logscope-0.1.0.tgz
  ```
- Your Node version still needs to be **20+** regardless of how you install.

---

## The browser didn't open automatically

No problem — logscope always prints the address. Look for a line like:

```
logscope → http://127.0.0.1:4477
```

**Copy that address into your browser manually.** You can also disable auto-open with
`--no-open` if you prefer to open it yourself.

---

## "Port already in use" / it won't start

Something else is using the port (or a previous logscope is still running).

- Start on a different port: `logscope --port 5001`
- Or find and stop the old one: go to its terminal and press `Ctrl + C`.

---

## My file didn't show up

- Confirm the file is **inside the folder logscope is watching** (the path it printed
  at startup).
- Check the **extension** is supported: `.json`, `.ndjson`, `.csv`, `.txt`, `.log`.
- If it's still downloading, wait a moment — logscope waits for the file to finish
  writing before loading it.
- Try **dragging the file directly onto the page**, or use **◧ Files → ⊕ Add files**.

---

## It warns my export is "truncated" / exactly 10,000 rows

CloudWatch Logs Insights caps exports at **10,000 rows**, so a 10,000-row file was
almost certainly cut off. Re-export with a **narrower time range** or **tighter query
filters** so the full result fits. See [Exporting logs](./exporting-logs.md#️-the-10000-row-limit--read-this).

---

## A log line looks garbled or wasn't parsed

logscope never crashes on bad input — anything it can't parse is shown as **raw text
with a warning** rather than being dropped. If a row looks off, click it to see the raw
content in the detail panel. Prefer **JSON** exports over CSV for the cleanest results.

---

## Two separate events got merged into one

This happens when two genuinely different events share the **exact same millisecond**
timestamp — logscope can't always tell them apart when reconstructing from logs that
were already emitted. The **rejoin count** on the row (e.g. `3×`) is how you spot it.
It's a known limitation of after-the-fact reconstruction, not a bug.

---

## Is any of my data uploaded or saved?

No.

- logscope makes **no network connections** — you can run it with Wi-Fi off to prove it.
- It keeps everything **in memory** and forgets it all when you stop the program
  (`Ctrl + C`). The only files written to disk are exports **you** explicitly create.
- It treats your log folder as **read-only** — it never edits, moves, or deletes your files.

---

## How do I stop it?

Go to the terminal where it's running and press **`Ctrl + C`**.

---

## How do I update to a newer version?

- If you use `npx logscope`, you always get the latest automatically.
- If you installed it globally: `npm install -g logscope@latest`.

---

Still stuck? Check the [User Guide](./user-guide.md) or the project's `VERIFY.md` for a
step-by-step sanity check.
