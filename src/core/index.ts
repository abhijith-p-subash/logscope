/**
 * Public surface of the pure engine, plus the file-ingest pipeline.
 *
 * This is the boundary `cli/` and `server/` consume. It takes file text in and
 * returns events, traces, and diagnostics out — no I/O, no Node APIs.
 */

import { assignGaps, clusterErrors } from "./analyze.ts";
import { buildTraces } from "./correlate.ts";
import type { Diagnostics, LogEvent, LogFile, Trace } from "./model.ts";
import { parseFile } from "./parse.ts";
import { stitchRows } from "./stitch.ts";

export * from "./model.ts";
export { parseFile, parseCSV, tryJSON } from "./parse.ts";
export { recover, closers, stitchRows, makeEvent, rowTime, rowMsg } from "./stitch.ts";
export { buildTraces, findKey, extractRid, RID_KEYS } from "./correlate.ts";
export {
  detectLevel,
  signature,
  clusterErrors,
  assignGaps,
  stepKey,
  waterfall,
  diffTraces,
  diffPayloads,
  goldenPath,
  concurrency,
  agentTree,
} from "./analyze.ts";
export type {
  WaterfallStep,
  Waterfall,
  PayloadChange,
  DiffStatus,
  DiffRow,
  Deviation,
  GoldenPath,
  Concurrency,
  AgentNode,
} from "./analyze.ts";
export {
  redactString,
  redactValue,
  redactEvent,
  previewRedaction,
  defaultRedaction,
  DEFAULT_RULES,
  DEFAULT_ID_FIELDS,
} from "./redact.ts";
export type { RedactionRule, RedactionConfig } from "./redact.ts";
export { buildEvidenceBundle } from "./report.ts";
export type { BundleOptions } from "./report.ts";
export { parseTimestamp, formatTime, formatGap, IST_OFFSET_MIN } from "./time.ts";
export type { TimeMode } from "./time.ts";
export { buildMatcher, highlight, escapeHtml } from "./search.ts";

/** One file's raw content, as handed to {@link ingestFiles}. */
export interface FileInput {
  name: string;
  text: string;
  size?: number;
  hash?: string;
}

/** The fully assembled session state produced from a set of files. */
export interface Session {
  files: LogFile[];
  /** All events, sorted by `(t, id)`, with gaps assigned. */
  events: LogEvent[];
  traces: Trace[];
  /** Top error signatures across all events, by count. */
  signatures: Array<{ sig: string; count: number }>;
  /** Diagnostics per file, keyed by file name. */
  diagnostics: Record<string, Diagnostics>;
}

/**
 * One file parsed and stitched, independent of any other file. Event ids are
 * local (0-based) and gaps are not yet assigned — {@link assembleSession} does
 * the global merge. This is the unit the server caches by content hash so an
 * unchanged file is never re-parsed on a later change (see server/store).
 */
export interface ParsedFile {
  name: string;
  size: number;
  hash: string;
  count: number;
  /** Events in ascending time order, with local ids. */
  events: LogEvent[];
  diagnostics: Diagnostics;
}

/** Parse + stitch a single file. Pure and independent — safe to cache by hash. */
export function parseOneFile(input: FileInput): ParsedFile {
  const { rows, diagnostics } = parseFile(input.name, input.text);
  const events = stitchRows(rows, input.name, 0);
  return {
    name: input.name,
    size: input.size ?? input.text.length,
    hash: input.hash ?? "",
    count: events.length,
    events,
    diagnostics,
  };
}

/**
 * Merge already-parsed files into a full session: assign globally-unique ids
 * (in file order, so the time-sort tiebreak is stable), merge onto one
 * timeline, assign gaps, and build traces + signatures. Does no parsing, so a
 * rebuild after one file changes reuses every other file's cached parse.
 */
export function assembleSession(parsed: ParsedFile[]): Session {
  const files: LogFile[] = [];
  const diagnostics: Record<string, Diagnostics> = {};

  // Count total up front so we can size the merged array once (no spread-push,
  // which throws RangeError past ~100k elements — a real crash on the target
  // workload).
  let total = 0;
  for (const p of parsed) total += p.events.length;
  const events = new Array<LogEvent>(total);

  let gid = 0;
  let at = 0;
  for (const p of parsed) {
    for (const e of p.events) {
      e.id = gid++;
      events[at++] = e;
    }
    diagnostics[p.name] = p.diagnostics;
    files.push({ name: p.name, size: p.size, hash: p.hash, count: p.count, on: true });
  }

  events.sort((a, b) => a.t - b.t || a.id - b.id);
  assignGaps(events);

  return {
    files,
    events,
    traces: buildTraces(events),
    signatures: clusterErrors(events),
    diagnostics,
  };
}

/**
 * Run the full pipeline over a set of files: parse → stitch → merge → assign
 * gaps → build traces. Global event ids are unique across files, and gaps are
 * computed across the merged timeline (not per file).
 */
export function ingestFiles(inputs: FileInput[]): Session {
  return assembleSession(inputs.map(parseOneFile));
}
