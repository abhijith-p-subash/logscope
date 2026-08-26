/**
 * Fragment stitching — rejoining CloudWatch events that were shredded because
 * pretty-printed JSON (`json.dumps(obj, indent=2)`) meets CloudWatch's
 * one-event-per-newline behavior.
 *
 * Algorithm (CLAUDE.md — getting this wrong reintroduces real defects):
 *  1. Sort by `(timestamp, originalIndex)` — stable, preserving order within a ms.
 *  2. Group *consecutive* events sharing an identical millisecond timestamp.
 *  3. Join their messages with `\n`.
 *  4. Recover the JSON payload.
 *
 * Known limitation (keep visible via the per-row rejoin count): two genuinely
 * separate events in the same millisecond will merge incorrectly.
 */

import { detectLevel, signature } from "./analyze.ts";
import { extractRid } from "./correlate.ts";
import type { LogEvent } from "./model.ts";
import { parseTimestamp } from "./time.ts";

type Row = Record<string, unknown>;

/** Timestamp field names, tried in order. */
const TS_KEYS = [
  "@timestamp",
  "timestamp",
  "time",
  "ts",
  "Timestamp",
  "eventTime",
  "datetime",
  "date",
  "ingestionTime",
];

/** Message field names, tried in order. */
const MSG_KEYS = ["@message", "message", "msg", "log", "Message", "event", "line", "text"];

/** Leading timestamp prefix stripped when deriving a fallback title. */
const PREFIX = /^\s*\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]\d{0,6}Z?\s*/;

/** Extract a row's timestamp in epoch ms, or null. */
export function rowTime(r: Row): number | null {
  for (const k of TS_KEYS) {
    if (k in r) {
      const v = parseTimestamp(r[k]);
      if (v != null) return v;
    }
  }
  return null;
}

/** Extract a row's message text. Non-string message fields are stringified. */
export function rowMsg(r: Row): string {
  for (const k of MSG_KEYS) {
    if (k in r && r[k] != null) {
      const m = r[k];
      return typeof m === "string" ? m : JSON.stringify(m);
    }
  }
  return JSON.stringify(r);
}

function tryJSON(s: string): unknown | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Compute the closing brackets needed to repair a truncated JSON fragment,
 * tracking quote and escape state so braces *inside strings* are not counted.
 * If the string ends mid-quote, a closing `"` is prepended.
 */
export function closers(s: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
  }
  return (
    (inStr ? '"' : "") +
    stack
      .reverse()
      .map((c) => (c === "{" ? "}" : "]"))
      .join("")
  );
}

/** Module-scoped so we don't allocate a new RegExp per event (100k+ calls). */
const OPENER_RE = /[{[]/g;

/**
 * Cheap grammar pre-check: can a JSON value legally start right after the
 * opener at `i`? Objects must be followed by `"` or `}`; arrays by a value or
 * `]`. Lets us skip the expensive slice+parse for stray brackets in log
 * prefixes (`[INFO]`, `[TOOL_RESULT:x]`), which is the common failure case for
 * plain-text rows. Returns true at end-of-string so truncation repair still runs.
 */
function canStartJSON(s: string, i: number): boolean {
  const open = s[i];
  let j = i + 1;
  while (j < s.length) {
    const w = s[j];
    if (w === " " || w === "\n" || w === "\r" || w === "\t") j++;
    else break;
  }
  if (j >= s.length) return true; // opener at end → let closers() try to repair
  const c = s[j]!;
  if (open === "{") return c === '"' || c === "}";
  // array: a value start or an empty array
  return (
    c === '"' ||
    c === "{" ||
    c === "[" ||
    c === "]" ||
    c === "-" ||
    (c >= "0" && c <= "9") ||
    c === "t" ||
    c === "f" ||
    c === "n"
  );
}

/**
 * Recover a JSON payload from arbitrary text.
 *
 * Critical: scan *every* `{` and `[` position left to right and take the first
 * that parses. Do not cut at the first brace — log prefixes contain brackets
 * (`[INFO] agent.tools — [TOOL_RESULT:x] {...}`), so cutting early fails. This
 * is the single most common bug in this logic.
 *
 * For each opener, first try the raw slice, then try repairing truncation by
 * appending inferred closing brackets.
 *
 * @returns the parsed payload and the index it started at (`cut`), or
 *   `{ payload: null, cut: -1 }`.
 */
export function recover(s: string): { payload: unknown | null; cut: number } {
  OPENER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = OPENER_RE.exec(s)) !== null && n < 300) {
    n++;
    const idx = m.index;
    // Skip openers that can't begin valid JSON without paying for a slice+parse.
    if (!canStartJSON(s, idx)) continue;
    const cand = s.slice(idx);
    let v = tryJSON(cand);
    if (v === null) {
      // Only attempt bracket-repair when there is actually something to close;
      // a balanced candidate that failed to parse won't parse with no change.
      const close = closers(cand);
      if (close) v = tryJSON(cand + close);
    }
    if (v !== null) return { payload: v, cut: idx };
  }
  return { payload: null, cut: -1 };
}

/**
 * Build a single {@link LogEvent} from one or more raw rows that share a ms
 * timestamp. Joins messages, recovers JSON (retrying with reversed fragment
 * order, since Insights returns results newest-first), and derives a title,
 * level, correlation id, and error signature.
 */
export function makeEvent(
  t: number | null,
  rows: Row[],
  fileName: string,
  id: number,
): LogEvent {
  const lines = rows.map(rowMsg);
  const joined = lines.join("\n");

  // Forward join first; if it fails to parse, retry with fragments reversed.
  let rec = recover(joined);
  if (!rec.payload && rows.length > 1) {
    rec = recover(lines.slice().reverse().join("\n"));
  }
  let payload = rec.payload;
  const cut = rec.cut;

  // If the message itself wasn't JSON but this is a single structured record
  // (an NDJSON/JSON/CSV/Insights row with fields beyond a bare `message`), use
  // the record as the payload so its level, ids, and fields are available.
  // Text-fallback rows (`{message}` only) are deliberately left as plain text.
  if (payload === null && rows.length === 1) {
    const row = rows[0]!;
    const keys = Object.keys(row);
    const isBareTextRow = keys.length === 1 && keys[0] === "message";
    if (keys.length > 0 && !isBareTextRow) payload = row;
  }

  // Title: prefer the text before the JSON, then a payload message field, then
  // the payload's top keys, then the first raw line with its timestamp stripped.
  let title = cut > 0 ? joined.slice(0, cut).trim() : "";
  if (!title && payload && !Array.isArray(payload)) {
    const p = payload as Record<string, unknown>;
    const v = p.message ?? p.msg ?? p.event ?? p.action ?? p.error ?? p.errorMessage;
    title = typeof v === "string" && v ? v : Object.keys(p).slice(0, 6).join(", ");
  }
  if (!title) title = (lines[0] ?? "").replace(PREFIX, "").trim() || "(empty)";
  title = title.replace(/\s+/g, " ").slice(0, 600);

  const level = detectLevel(joined, payload);
  const rid = extractRid(payload, rows[0], joined);

  return {
    id,
    t: t ?? 0,
    hasTime: t != null,
    frags: rows.length,
    level,
    rid,
    title,
    payload,
    parsed: payload !== null,
    text: joined,
    file: fileName,
    sig: level === "error" ? signature(title) : null,
    el: null,
  };
}

/**
 * Stitch a file's raw rows into events. Sorts by `(t, originalIndex)`, groups
 * consecutive rows with identical timestamps, and rejoins each group.
 *
 * If no row has a parseable timestamp, every row becomes its own event (with
 * `t = 0`) so nothing is lost.
 *
 * @param startId id to assign to the first produced event; ids increment from there.
 */
export function stitchRows(rows: Row[], fileName: string, startId = 0): LogEvent[] {
  const withT: Array<{ r: Row; i: number; t: number }> = [];
  rows.forEach((r, i) => {
    const t = rowTime(r);
    if (t != null) withT.push({ r, i, t });
  });

  if (!withT.length) {
    return rows.map((r, i) => makeEvent(null, [r], fileName, startId + i));
  }

  // Stable sort by (t, originalIndex).
  withT.sort((a, b) => a.t - b.t || a.i - b.i);

  const groups: Array<{ t: number; rows: Row[] }> = [];
  let cur: { t: number; rows: Row[] } | null = null;
  for (const x of withT) {
    if (cur && x.t === cur.t) cur.rows.push(x.r);
    else {
      cur = { t: x.t, rows: [x.r] };
      groups.push(cur);
    }
  }

  return groups.map((g, i) => makeEvent(g.t, g.rows, fileName, startId + i));
}
