# Getting Started

This guide is written so that **anyone can follow it — no programming experience required.**
By the end you'll have logscope running and a set of logs open in your browser.

It takes about 5–10 minutes the first time.

---

## What is logscope, in one sentence?

It's a small program that runs on **your own computer**, reads AWS CloudWatch log
files you've already downloaded, and shows them in a clean, searchable web page —
untangling the mess that CloudWatch normally produces.

Nothing is ever uploaded anywhere. It works with your Wi-Fi turned off.

---

## Step 1 — Install the one prerequisite: Node.js

logscope needs a free tool called **Node.js** (version **20 or newer**) to run.
This is the *only* thing you need to install first. You install it once and never
think about it again.

### Do I already have it?

Open a terminal and check:

- **Windows:** press the `Windows` key, type **PowerShell**, press Enter, then type:
  ```powershell
  node --version
  ```
- **Mac:** press `Cmd + Space`, type **Terminal**, press Enter, then type:
  ```bash
  node --version
  ```
- **Linux:** open your **Terminal** app and type:
  ```bash
  node --version
  ```

If it prints something like `v20.11.0` or higher (v22, v24…), you're done — **skip to Step 2.**
If it says "command not found" or shows a number **below 20**, install it below.

### How to install Node.js

**Easiest way (any OS):**
1. Go to **https://nodejs.org**
2. Download the button that says **"LTS"** (Long-Term Support — the recommended, stable version).
3. Open the downloaded file and click **Next → Next → Install** (accept the defaults).
4. **Close and reopen** your terminal, then run `node --version` again to confirm.

> 💼 **On a work/managed laptop?** If the installer is blocked, ask your IT team to
> install "Node.js 20 LTS," or use a package manager that's already approved:
> - Windows: `winget install OpenJS.NodeJS.LTS`
> - Mac: `brew install node`
> - Linux: use your distro's package manager (e.g. `sudo apt install nodejs`) or [nvm](https://github.com/nvm-sh/nvm).

That's the only prerequisite. ✅

---

## Step 2 — Get logscope

You have two options. **Option A needs no installation at all** and is the fastest
way to try it.

### Option A — Run it without installing (recommended to start)

In your terminal, type:

```bash
npx logscope-cli
```

The first time, it will ask to download logscope — type `y` and press Enter.
That's it: it starts up and opens your browser automatically.

### Option B — Install it permanently

If you'll use it often, install it once so the command is always available:

```bash
npm install -g logscope-cli
```

Then you can simply run `logscope` any time.

> If your company uses a private/internal package registry, your team may give you
> a slightly different install command (a company URL or a downloaded file). Ask
> whoever shared logscope with you. See [Troubleshooting](./troubleshooting.md) if
> `npx`/`npm install` can't reach the registry.

---

## Step 3 — Point it at your logs

logscope **watches a folder** and shows any log files inside it. New files that land
in that folder appear automatically — no refresh needed.

**Watch your Downloads folder** (where exported logs usually land):

```bash
logscope ~/Downloads
```

(On Windows, `logscope` on its own watches the folder your terminal is currently in;
you can also drag a folder into the terminal after typing `logscope ` to fill in its path.)

Or **open a single file** you already have:

```bash
logscope open path/to/export.json
```

Don't have logs yet? See **[Exporting logs from CloudWatch](./exporting-logs.md).**
You can also just **drag-and-drop** files onto the logscope web page once it's open.

---

## Step 4 — Use it

When logscope starts it prints a line like:

```
logscope → http://127.0.0.1:4477
```

…and opens that page in your browser. If it doesn't open automatically, **copy that
address into your browser** manually.

From here, head to the **[User Guide](./user-guide.md)** to learn how to read traces,
search, compare runs, and export evidence.

To **stop** logscope, go back to the terminal and press `Ctrl + C`.

---

## Quick recap

| Step | Command |
|------|---------|
| 1. Check Node.js (need v20+) | `node --version` |
| 2. Run logscope (no install) | `npx logscope-cli` |
| 3. Watch a folder | `logscope ~/Downloads` |
| 4. Open one file | `logscope open export.json` |
| Stop it | `Ctrl + C` in the terminal |

Stuck on any step? See **[Troubleshooting](./troubleshooting.md).**
