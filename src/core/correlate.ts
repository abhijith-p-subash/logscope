/**
 * Trace assembly — grouping events by correlation id.
 *
 * This is the feature the product exists for (DECISIONS.md D1). `@requestId` is
 * attached automatically by CloudWatch for Lambda and is the most reliable key,
 * so it is tried first.
 */

import type { LogEvent, Trace } from "./model.ts";

/**
 * Correlation-id field names, in priority order (CLAUDE.md). `@requestId` first
 * because CloudWatch adds it for Lambda with no service change required.
 */
export const RID_KEYS = [
  "@requestId",
  "request_id",
  "requestId",
  "correlation_id",
  "correlationId",
  "trace_id",
  "traceId",
] as const;

/** Fallback regex over raw text when no structured id field is present. */
const RID_TEXT = /"(?:request|correlation|trace)_?[iI][dD]"\s*:\s*"([^"]{4,})"/;

/**
 * Depth-first search for the first non-empty string value under any of `names`,
 * to a maximum nesting depth of 4. Names are checked in priority order at each
 * level before descending, so a top-level `@requestId` beats a nested `traceId`.
 */
export function findKey(o: unknown, names: readonly string[], depth = 0): string | null {
  if (!o || typeof o !== "object" || depth > 4) return null;
  const obj = o as Record<string, unknown>;
  for (const n of names) {
    const v = obj[n];
    if (typeof v === "string" && v) return v;
  }
  for (const k in obj) {
    const v = findKey(obj[k], names, depth + 1);
    if (v) return v;
  }
  return null;
}

/**
 * Extract a correlation id for one stitched event. Tries, in order:
 *  1. structured id fields in the recovered payload (nested to depth 4)
 *  2. `@requestId` / `requestId` on the raw first row (CSV/Insights columns)
 *  3. a regex over the raw joined text
 */
export function extractRid(
  payload: unknown | null,
  firstRow: Record<string, unknown> | undefined,
  joined: string,
): string | null {
  const fromPayload = payload ? findKey(payload, RID_KEYS) : null;
  if (fromPayload) return fromPayload;

  if (firstRow) {
    const a = firstRow["@requestId"];
    if (typeof a === "string" && a) return a;
    const b = firstRow["requestId"];
    if (typeof b === "string" && b) return b;
  }

  const m = joined.match(RID_TEXT);
  return m?.[1] ?? null;
}

/**
 * Group events into traces by correlation id. Events without an id are omitted
 * (they cannot be attributed to a request). Each trace's events are ordered by
 * `(t, id)`; traces are returned ordered by start time.
 */
export function buildTraces(events: LogEvent[]): Trace[] {
  const byRid = new Map<string, LogEvent[]>();
  for (const e of events) {
    if (!e.rid) continue;
    let arr = byRid.get(e.rid);
    if (!arr) byRid.set(e.rid, (arr = []));
    arr.push(e);
  }

  const traces: Trace[] = [];
  for (const [rid, evs] of byRid) {
    evs.sort((a, b) => a.t - b.t || a.id - b.id);
    const start = evs[0]!.t;
    const end = evs[evs.length - 1]!.t;
    traces.push({
      rid,
      events: evs,
      start,
      end,
      duration: end - start,
      errorCount: evs.reduce((n, e) => n + (e.level === "error" ? 1 : 0), 0),
    });
  }

  traces.sort((a, b) => a.start - b.start || a.rid.localeCompare(b.rid));
  return traces;
}
