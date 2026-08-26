# logscope documentation

Welcome! Pick the guide that matches what you need.

## 🟢 New here? Start with these

1. **[Getting Started](./getting-started.md)** — install the one prerequisite (Node.js)
   and get logscope running. Written for non-technical users, step by step.
2. **[Exporting logs from CloudWatch](./exporting-logs.md)** — how to get a log file out
   of AWS to open in logscope (and the important 10,000-row limit).
3. **[User Guide](./user-guide.md)** — using the app: traces, search, filters,
   waterfalls, run diff, evidence bundles, and keyboard shortcuts.

## 📖 Reference

- **[CLI Reference](./cli-reference.md)** — every command, flag, and the config file.
- **[Troubleshooting & FAQ](./troubleshooting.md)** — fixes for the common problems.

## 🛠 For contributors

- **[Development](./development.md)** — repo setup, scripts, layout, publishing.

---

### What is logscope?

An offline tool that turns messy AWS CloudWatch log exports into readable, traceable
events — on your own machine, with no network access and nothing saved to disk.
See the [root README](../README.md) for the short overview.

### The 30-second version

```bash
# 1. Make sure you have Node.js 20+
node --version

# 2. Run it (downloads on first use, opens your browser)
npx logscope ~/Downloads

# 3. Stop it any time with Ctrl + C
```

Prerequisite: **Node.js 20 or newer** — that's the only thing you install.
Full walkthrough in [Getting Started](./getting-started.md).
