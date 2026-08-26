/**
 * Core domain types for logscope.
 *
 * `core/` is pure logic: it takes strings in and returns data out. It must not
 * import from `server/` or `cli/`, and must not touch Node APIs, so the engine
 * stays portable and trivially unit-testable (see CLAUDE.md).
 */

/** Severity buckets. Ordered low→high in {@link LEVEL_ORDER}. */
export type Level = "debug" | "info" | "warn" | "error";

/** Relative severity for sorting. Higher is more severe. */
export const LEVEL_ORDER: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Every input format logscope sniffs and parses. */
export type Format = "json" | "ndjson" | "csv" | "insights" | "text";

/**
 * A single reconstructed log event.
 *
 * One event may be the rejoin of many fragmented CloudWatch rows (see
 * {@link frags}) that shared an identical millisecond timestamp. Timestamps are
 * always UTC epoch milliseconds — never a formatted string; formatting happens
 * only at render (see `time.ts`).
 */
export interface LogEvent {
  /** Stable global id, assigned at load. Survives sorting/filtering. */
  id: number;
  /** UTC epoch milliseconds. `0` when no timestamp could be parsed. */
  t: number;
  /** Whether a timestamp was actually found (distinguishes a real t=0 from unknown). */
  hasTime: boolean;
  /** How many raw rows were rejoined into this event. `1` means no stitching. */
  frags: number;
  level: Level;
  /** Correlation / request id, if one was found. */
  rid: string | null;
  /** Short human-readable summary shown in the row. */
  title: string;
  /** Recovered JSON payload, or `null` if the event is plain text. */
  payload: unknown | null;
  /** True when {@link payload} was successfully recovered as JSON. */
  parsed: boolean;
  /** The raw joined message text (all fragments, `\n`-joined). */
  text: string;
  /** Source file name this event came from. */
  file: string;
  /** Normalized error signature, or `null` for non-errors. */
  sig: string | null;
  /** Gap in ms to the previous event in global time order. `null` for the first. */
  el: number | null;
}

/**
 * All events sharing a correlation id, ordered by time. This is the central
 * abstraction of the product (see DECISIONS.md D1) — not the log line.
 */
export interface Trace {
  rid: string;
  /** Events ordered by `(t, id)`. */
  events: LogEvent[];
  start: number;
  end: number;
  /** `end - start` in ms. */
  duration: number;
  errorCount: number;
}

/** A loaded source file and its toggle state. */
export interface LogFile {
  name: string;
  size: number;
  /** Content hash for dedupe (server sets this; may be empty in pure-core use). */
  hash: string;
  /** Number of events parsed from this file. */
  count: number;
  /** Whether the file is currently included in the view. */
  on: boolean;
}

/** Non-fatal parsing observations surfaced in the UI. Never throw; degrade. */
export interface Diagnostics {
  format: Format;
  /** Number of raw rows the parser extracted (before stitching). */
  rowCount: number;
  /**
   * True when the export almost certainly hit the CloudWatch Insights 10,000-row
   * cap. Showing partial data silently is worse than warning (see CLAUDE.md).
   */
  truncated: boolean;
  /** Human-readable warnings to show alongside the data. */
  warnings: string[];
}

/** Result of parsing one file into raw rows, before stitching. */
export interface ParseResult {
  rows: Record<string, unknown>[];
  diagnostics: Diagnostics;
}
