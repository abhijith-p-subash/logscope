/**
 * chokidar wrapper: watches a folder, reads new/changed files, and feeds them to
 * the store. Read-only — it never writes, moves, or deletes anything (CLAUDE.md
 * constraint 4). `awaitWriteFinish` waits for incremental writes (a download in
 * progress) to settle before reading, and the store dedupes by content hash.
 */
import chokidar from "chokidar";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { FileInput } from "../core/index.ts";
import type { Store } from "./store.ts";

/** Extensions we ingest. (Kept alongside the CLI's copy; both are I/O layers.) */
const SUPPORTED = /\.(json|ndjson|csv|txt|log)$/i;

export interface WatcherOptions {
  /** ms a file size must stay stable before we read it. Default 300. */
  stabilityThreshold?: number;
  /** ms to coalesce a burst of file events into one rebuild. Default 40. */
  batchWindow?: number;
  /** Called once chokidar has processed the initial folder contents. */
  onReady?: () => void;
  /** Called on any load/removal (for logging). */
  onChange?: (msg: string) => void;
  /** Called on a read/parse error (for logging). Never throws. */
  onError?: (msg: string) => void;
}

export interface Watcher {
  close(): Promise<void>;
}

export function startWatcher(dir: string, store: Store, opts: WatcherOptions = {}): Watcher {
  const stability = opts.stabilityThreshold ?? 300;
  const batchWindow = opts.batchWindow ?? 40;

  const watcher = chokidar.watch(dir, {
    ignoreInitial: false, // pick up files already sitting in the folder
    depth: 0, // one level, matching the CLI folder scan
    awaitWriteFinish: { stabilityThreshold: stability, pollInterval: Math.min(100, stability) },
    // Never auto-load test fixtures, build artefacts, or dependencies.
    ignored: /[/\\](testdata|node_modules|dist)[/\\]/,
  });

  // Coalesce a burst of add/change events (bulk drop or initial scan) into a
  // single batched ingest so the store recomputes and broadcasts only once,
  // instead of once per file (which is O(files²) work on startup).
  const pending = new Map<string, string>(); // name -> path (dedupe by name)
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async (): Promise<void> => {
    timer = null;
    const paths = [...pending.values()];
    pending.clear();
    if (!paths.length) return;

    const inputs: FileInput[] = [];
    for (const path of paths) {
      try {
        const buf = await readFile(path);
        const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
        inputs.push({ name: basename(path), text: buf.toString("utf8"), size: buf.length, hash });
      } catch (e) {
        opts.onError?.(`could not read ${basename(path)}: ${(e as Error).message}`);
      }
    }
    if (!inputs.length) return;

    const results = store.addOrUpdateMany(inputs);
    for (const r of results) {
      if (r.result !== "noop") {
        opts.onChange?.(`${r.result === "added" ? "loaded" : "reloaded"} ${r.name}`);
      }
    }
  };

  const schedule = (path: string): void => {
    if (!SUPPORTED.test(path)) return;
    pending.set(basename(path), path);
    if (!timer) timer = setTimeout(() => void flush(), batchWindow);
  };

  watcher
    .on("add", schedule)
    .on("change", schedule)
    .on("unlink", (path) => {
      if (!SUPPORTED.test(path)) return;
      pending.delete(basename(path)); // cancel a pending load for a removed file
      if (store.remove(basename(path))) {
        opts.onChange?.(`removed ${basename(path)}`);
      }
    })
    .on("ready", () => opts.onReady?.())
    .on("error", (e) => opts.onError?.(`watch error: ${(e as Error).message}`));

  return {
    close: async () => {
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
