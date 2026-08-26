/**
 * In-memory session store.
 *
 * Everything lives in memory and dies with the process — no database, no cache,
 * no disk writes (DECISIONS.md D4: these logs carry client PII and must not
 * accumulate on laptops). Files are held by name; re-adding identical content
 * (same content hash) is a no-op so re-downloading an export does nothing.
 *
 * Ingest is incremental: each file is parsed once and cached by content hash
 * (see {@link ParsedFile}), so a change to one file never re-parses the others —
 * only the cheap merge/correlate step re-runs. Raw file text is dropped after
 * parsing; nothing but the parsed events is retained.
 */
import {
  assembleSession,
  parseOneFile,
  type FileInput,
  type LogFile,
  type ParsedFile,
  type Session,
} from "../core/index.ts";

export interface StoreSummary {
  files: LogFile[];
  events: number;
  traces: number;
  errors: number;
  warnings: string[];
}

export type ChangeKind = "add" | "update" | "remove";

export interface StoreChange {
  kind: ChangeKind;
  file: string;
  summary: StoreSummary;
}

type Listener = (change: StoreChange) => void;

/** Warn when total loaded content passes this — a laptop-memory guard rail. */
const MEM_WARN_BYTES = 512 * 1024 * 1024;

export class Store {
  private parsed = new Map<string, ParsedFile>();
  private session: Session = assembleSession([]);
  private listeners = new Set<Listener>();

  // Derived data, recomputed once per change and memoized until the next one.
  private cachedSummary: StoreSummary | null = null;
  private cachedSessionJSON: string | null = null;

  /**
   * Add a file, or replace it if its content changed. Returns `"noop"` when the
   * same name with identical content is already present (content-hash dedupe).
   */
  addOrUpdate(input: FileInput): "added" | "updated" | "noop" {
    const existing = this.parsed.get(input.name);
    if (existing && existing.hash === (input.hash ?? "")) return "noop";

    this.parsed.set(input.name, parseOneFile(input));
    this.recompute();

    const kind: ChangeKind = existing ? "update" : "add";
    this.emit({ kind, file: input.name, summary: this.summary() });
    return existing ? "updated" : "added";
  }

  /**
   * Add or update several files, recomputing and broadcasting only once. Used by
   * the watcher to coalesce a burst of file events (a bulk drop or the initial
   * folder scan) into a single rebuild instead of one per file.
   */
  addOrUpdateMany(inputs: FileInput[]): Array<{ name: string; result: "added" | "updated" | "noop" }> {
    const results: Array<{ name: string; result: "added" | "updated" | "noop" }> = [];
    let anyChanged = false;
    let anyAdded = false;
    let lastChanged = "";
    let changedCount = 0;

    for (const input of inputs) {
      const existing = this.parsed.get(input.name);
      if (existing && existing.hash === (input.hash ?? "")) {
        results.push({ name: input.name, result: "noop" });
        continue;
      }
      this.parsed.set(input.name, parseOneFile(input));
      anyChanged = true;
      if (!existing) anyAdded = true;
      lastChanged = input.name;
      changedCount++;
      results.push({ name: input.name, result: existing ? "updated" : "added" });
    }

    if (anyChanged) {
      this.recompute();
      this.emit({
        kind: anyAdded ? "add" : "update",
        file: changedCount === 1 ? lastChanged : `${changedCount} files`,
        summary: this.summary(),
      });
    }
    return results;
  }

  /** Remove a file by name. Returns false if it was not present. */
  remove(name: string): boolean {
    if (!this.parsed.delete(name)) return false;
    this.recompute();
    this.emit({ kind: "remove", file: name, summary: this.summary() });
    return true;
  }

  /** The full assembled session (events, traces, signatures, diagnostics). */
  getSession(): Session {
    return this.session;
  }

  /**
   * The session serialized to JSON, memoized until the next change. Repeated
   * `/api/session` fetches then don't re-stringify a multi-megabyte payload.
   */
  getSessionJSON(): string {
    if (this.cachedSessionJSON === null) {
      this.cachedSessionJSON = JSON.stringify(this.session);
    }
    return this.cachedSessionJSON;
  }

  /** A lightweight summary suitable for SSE and the status line (memoized). */
  summary(): StoreSummary {
    if (this.cachedSummary) return this.cachedSummary;

    let errors = 0;
    for (const e of this.session.events) if (e.level === "error") errors++;
    const warnings = Object.values(this.session.diagnostics).flatMap((d) => d.warnings);

    let totalBytes = 0;
    for (const p of this.parsed.values()) totalBytes += p.size;
    if (totalBytes > MEM_WARN_BYTES) {
      warnings.unshift(
        `Loaded content is ${(totalBytes / (1024 * 1024)).toFixed(0)} MB across ${this.parsed.size} files — ` +
          `logscope keeps everything in memory. Remove files you don't need to free it.`,
      );
    }

    this.cachedSummary = Object.freeze({
      files: this.session.files,
      events: this.session.events.length,
      traces: this.session.traces.length,
      errors,
      warnings,
    });
    return this.cachedSummary;
  }

  /** Subscribe to change events. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private recompute(): void {
    this.session = assembleSession([...this.parsed.values()]);
    this.cachedSummary = null;
    this.cachedSessionJSON = null;
  }

  private emit(change: StoreChange): void {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch {
        // A broken listener must never take down ingestion.
      }
    }
  }
}
