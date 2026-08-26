#!/usr/bin/env node
/**
 * logscope CLI entry point.
 *
 *   logscope [dir]              watch a folder, serve the UI (default; alias: watch)
 *   logscope ui                open the web UI only, watching nothing
 *   logscope open <file>       open a single file directly
 *   logscope scan <path>       terminal trace summary (--json for CI mode)
 *   logscope report <path>     write a PII-redacted HTML evidence bundle
 */
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";
import { runScan } from "./commands/scan.ts";
import { runServe } from "./commands/serve.ts";
import { runReport } from "./commands/report.ts";

const config = loadConfig();

/**
 * Read the published version from package.json. Both src/cli/index.ts and the
 * bundled dist/cli/index.js sit two levels below the package root, so one
 * relative path serves source runs and installed runs alike.
 */
function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(resolve(here, "..", "..", "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const program = new Command();

program
  .name("logscope")
  .description("Offline log analysis for AWS CloudWatch exports")
  .version(packageVersion());

interface ServeCliOptions {
  port?: string;
  open?: boolean;
}

/**
 * Merge CLI options with ~/.logscope.json defaults.
 *
 * `--port` deliberately declares no commander default: a default would make
 * `opts.port` always defined and silently shadow `config.port`. The 4477
 * fallback lives in runServe instead.
 */
function serveOpts(dir: string | undefined, opts: ServeCliOptions): { dir: string; opts: { port?: string; open?: boolean } } {
  const port = opts.port ?? (config.port != null ? String(config.port) : undefined);
  // --no-open (opts.open===false) always wins; otherwise honour config.open, default true.
  const open = opts.open === false ? false : (config.open ?? true);
  return { dir: dir ?? config.dir ?? ".", opts: { port, open } };
}

program
  .command("serve", { isDefault: true })
  .alias("watch")
  .description("Watch a folder and serve the web UI + API (default command)")
  .argument("[dir]", "folder to watch")
  .option("-p, --port <number>", "port to bind on 127.0.0.1 (default: 4477)")
  .option("--no-open", "do not open the browser")
  .action(async (dir: string | undefined, opts: ServeCliOptions) => {
    const { dir: d, opts: o } = serveOpts(dir, opts);
    await runServe(d, o);
  });

program
  .command("ui")
  .alias("app")
  .description("Launch the web UI only — no folder is watched; drop files onto the window")
  .option("-p, --port <number>", "port to bind on 127.0.0.1 (default: 4477)")
  .option("--no-open", "do not open the browser")
  .action(async (opts: ServeCliOptions) => {
    const { opts: o } = serveOpts(undefined, opts);
    await runServe(null, o);
  });

program
  .command("open")
  .description("Open a single log file directly")
  .argument("<file>", "log file to open")
  .option("-p, --port <number>", "port to bind on 127.0.0.1 (default: 4477)")
  .option("--no-open", "do not open the browser")
  .action(async (file: string, opts: ServeCliOptions) => {
    const { opts: o } = serveOpts(file, opts);
    await runServe(file, o);
  });

program
  .command("scan")
  .description("Parse logs and print a trace summary to the terminal")
  .argument("<path>", "log file or folder to scan")
  .option("--json", "emit machine-readable JSON and exit non-zero if errors are present (CI mode)")
  .action((path: string, opts: { json?: boolean }) => {
    process.exitCode = runScan(path, opts);
  });

program
  .command("report")
  .description("Write a self-contained, PII-redacted HTML evidence bundle")
  .argument("<path>", "log file or folder to report on")
  .option("-o, --out <file>", "output HTML file", "evidence.html")
  .option("--no-redact", "export without PII redaction")
  .option("--title <title>", "title for the bundle")
  .action((path: string, opts: { out?: string; redact?: boolean; title?: string }) => {
    process.exitCode = runReport(path, opts);
  });

program.parse();
