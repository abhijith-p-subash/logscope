/**
 * Classification and analysis: level detection, error-signature clustering,
 * and gap assignment. (Golden-path derivation and run-diff are Tier 2 and land
 * in a later phase; this file holds what Phase 1 and the `scan` command need.)
 */

import type { Level, LogEvent, Trace } from "./model.ts";

/**
 * Infer a severity level from an event's text and recovered payload.
 *
 * Prefers an explicit level field on the payload; otherwise falls back to
 * keyword sniffing over the message head. Defaults to `info`, but a message
 * that smells like a failure (error/exception/timeout/…) is treated as error.
 */
export function detectLevel(text: string, payload: unknown | null): Level {
  const pl = payload as Record<string, unknown> | null;
  const lvRaw = pl && (pl.level ?? pl.severity ?? pl.levelname ?? pl.log_level);
  if (typeof lvRaw === "string") {
    const l = lvRaw.toLowerCase();
    if (l.startsWith("err") || l === "critical" || l === "fatal") return "error";
    if (l.startsWith("warn")) return "warn";
    if (l.startsWith("debug") || l === "trace") return "debug";
    if (l.startsWith("info") || l === "notice") return "info";
  }

  const h = text.slice(0, 260);
  if (/\[(ERROR|CRITICAL|FATAL|SEVERE)\]|\bERROR\b|\bTraceback\b|\bException\b|\bstack trace\b/i.test(h))
    return "error";
  if (/\[WARN(ING)?\]|\bWARN(ING)?\b/.test(h)) return "warn";
  if (/\[DEBUG\]|\bDEBUG\b/.test(h)) return "debug";
  if (/\[INFO\]|\bINFO\b/.test(h)) return "info";
  return /\b(error|failed|failure|exception|denied|timeout)\b/i.test(h) ? "error" : "info";
}

/**
 * Normalize a message into an error signature by replacing the parts that vary
 * between otherwise-identical errors — UUIDs, timestamps, and long numbers —
 * with placeholders. Lets "the same error, 47 times" collapse to one line.
 */
export function signature(text: string): string {
  return text
    .slice(0, 200)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
    .replace(/\b\d{4}-\d{2}-\d{2}[T ][\d:.,]+Z?\b/g, "<ts>")
    .replace(/\b\d{5,}\b/g, "<num>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
}

/**
 * Assign each event's `el` (gap in ms to the previous event in global time
 * order). Mutates and returns the array. Assumes it is already sorted by
 * `(t, id)`. The first event's gap is `null`.
 */
export function assignGaps(events: LogEvent[]): LogEvent[] {
  let prev: number | null = null;
  for (const e of events) {
    e.el = prev == null ? null : e.t - prev;
    prev = e.t;
  }
  return events;
}

/** Cluster error events by normalized signature. Returns counts, descending. */
export function clusterErrors(events: LogEvent[]): Array<{ sig: string; count: number }> {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.sig) counts.set(e.sig, (counts.get(e.sig) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([sig, count]) => ({ sig, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * A normalized "step" identity used to align and compare traces — the event's
 * signature with variable parts (ids, timestamps, long numbers) removed.
 */
export function stepKey(e: LogEvent): string {
  return signature(e.title) || e.title.slice(0, 60);
}

// ---------------------------------------------------------------------------
// Trace waterfall — where did the time go?
// ---------------------------------------------------------------------------

export interface WaterfallStep {
  event: LogEvent;
  /** ms from the trace start. */
  offsetMs: number;
  /** ms since the previous step (0 for the first). */
  gapMs: number;
}

export interface Waterfall {
  steps: WaterfallStep[];
  totalMs: number;
  /** Index of the step with the largest preceding gap, or -1 if none. */
  largestGapIndex: number;
}

/**
 * Lay a trace out as timed steps and flag the largest gap — the slow step is
 * almost always the answer, and it should not require reading timestamps.
 */
export function waterfall(trace: Trace): Waterfall {
  const steps: WaterfallStep[] = [];
  let prev: number | null = null;
  let largestGap = 0;
  let largestGapIndex = -1;
  trace.events.forEach((event, i) => {
    const gapMs = prev == null ? 0 : event.t - prev;
    if (gapMs > largestGap) {
      largestGap = gapMs;
      largestGapIndex = i;
    }
    steps.push({ event, offsetMs: event.t - trace.start, gapMs });
    prev = event.t;
  });
  return { steps, totalMs: trace.duration, largestGapIndex };
}

// ---------------------------------------------------------------------------
// Run diff — compare two traces aligned by step
// ---------------------------------------------------------------------------

export interface PayloadChange {
  path: string;
  a: unknown;
  b: unknown;
}

export type DiffStatus = "same" | "changed" | "only-a" | "only-b";

export interface DiffRow {
  status: DiffStatus;
  a: LogEvent | null;
  b: LogEvent | null;
  changes: PayloadChange[];
}

function flatten(v: unknown, prefix = "", out: Map<string, unknown> = new Map()): Map<string, unknown> {
  if (Array.isArray(v)) {
    v.forEach((x, i) => flatten(x, `${prefix}[${i}]`, out));
  } else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) flatten(val, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.set(prefix, v);
  }
  return out;
}

/** Field-level difference between two payloads, keyed by dotted path. */
export function diffPayloads(a: unknown, b: unknown): PayloadChange[] {
  const fa = flatten(a);
  const fb = flatten(b);
  const keys = new Set([...fa.keys(), ...fb.keys()]);
  const changes: PayloadChange[] = [];
  for (const k of keys) {
    const va = fa.get(k);
    const vb = fb.get(k);
    // `flatten` only ever stores primitive leaves, so a direct compare is both
    // correct and avoids stringifying both sides for every key.
    if (va !== vb) changes.push({ path: k, a: va, b: vb });
  }
  return changes.sort((x, y) => x.path.localeCompare(y.path));
}

/**
 * Align two traces step-by-step (longest common subsequence over step keys) and
 * report steps present in one but not the other, plus field-level payload diffs
 * for matched steps. Comparing a passing run to a failing one is the single
 * fastest path to a root cause.
 */
export function diffTraces(a: Trace, b: Trace): DiffRow[] {
  const ka = a.events.map(stepKey);
  const kb = b.events.map(stepKey);
  const n = ka.length;
  const m = kb.length;

  // LCS DP table.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = ka[i] === kb[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ka[i] === kb[j]) {
      const ea = a.events[i]!;
      const eb = b.events[j]!;
      const changes = ea.parsed && eb.parsed ? diffPayloads(ea.payload, eb.payload) : [];
      rows.push({ status: changes.length ? "changed" : "same", a: ea, b: eb, changes });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      rows.push({ status: "only-a", a: a.events[i]!, b: null, changes: [] });
      i++;
    } else {
      rows.push({ status: "only-b", a: null, b: b.events[j]!, changes: [] });
      j++;
    }
  }
  while (i < n) rows.push({ status: "only-a", a: a.events[i++]!, b: null, changes: [] });
  while (j < m) rows.push({ status: "only-b", a: null, b: b.events[j++]!, changes: [] });
  return rows;
}

// ---------------------------------------------------------------------------
// Golden path — the modal trace shape, and who deviates from it
// ---------------------------------------------------------------------------

export interface Deviation {
  rid: string;
  matches: boolean;
  missing: string[];
  extra: string[];
  reordered: boolean;
}

export interface GoldenPath {
  shape: string[];
  /** Number of traces that exactly match the modal shape. */
  support: number;
  deviations: Deviation[];
}

const SEQ_SEP = ""; // control char: cannot occur in a step key, so join/split round-trips safely

/**
 * Derive the modal trace shape (most common ordered sequence of step keys) and
 * flag every trace that diverges — missing steps, extra steps, or reordering.
 * Surfaces interesting failures without the user knowing what to search for.
 */
export function goldenPath(traces: Trace[]): GoldenPath {
  if (!traces.length) return { shape: [], support: 0, deviations: [] };

  const seqs = traces.map((t) => t.events.map(stepKey));
  const freq = new Map<string, number>();
  for (const s of seqs) {
    const key = s.join(SEQ_SEP);
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  let bestKey = "";
  let support = 0;
  for (const [k, n] of freq) {
    if (n > support) {
      support = n;
      bestKey = k;
    }
  }
  const shape = bestKey === "" ? [] : bestKey.split(SEQ_SEP);
  const shapeSet = new Set(shape);

  const deviations: Deviation[] = [];
  traces.forEach((t, idx) => {
    const seq = seqs[idx]!;
    const set = new Set(seq);
    const missing = shape.filter((k) => !set.has(k));
    const extra = seq.filter((k) => !shapeSet.has(k));
    const sameSet = missing.length === 0 && extra.length === 0;
    const matches = seq.join(SEQ_SEP) === bestKey;
    const reordered = sameSet && !matches;
    if (!matches) deviations.push({ rid: t.rid, matches, missing, extra, reordered });
  });

  return { shape, support, deviations };
}

// ---------------------------------------------------------------------------
// Concurrency lens — how many traces were in flight over time
// ---------------------------------------------------------------------------

export interface Concurrency {
  t0: number;
  t1: number;
  series: number[];
  max: number;
}

/** Sample how many traces overlap each time bucket across the loaded range. */
export function concurrency(traces: Trace[], buckets = 200): Concurrency {
  if (!traces.length) return { t0: 0, t1: 0, series: [], max: 0 };

  // Single pass for the range — `Math.min(...arr)` spreads every element as an
  // argument and throws RangeError past ~100k traces.
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const t of traces) {
    if (t.start < t0) t0 = t.start;
    if (t.end > t1) t1 = t.end;
  }
  const span = Math.max(1, t1 - t0);

  // Sweep with a delta array + prefix sum: O(traces + buckets) instead of
  // O(traces × buckets). Each trace increments the buckets its span covers.
  const delta = new Array<number>(buckets + 1).fill(0);
  for (const tr of traces) {
    let sb = Math.floor(((tr.start - t0) / span) * buckets);
    let eb = Math.floor(((tr.end - t0) / span) * buckets);
    if (sb < 0) sb = 0;
    else if (sb >= buckets) sb = buckets - 1;
    if (eb < 0) eb = 0;
    else if (eb >= buckets) eb = buckets - 1;
    delta[sb]!++;
    delta[eb + 1]!--;
  }

  const series = new Array<number>(buckets).fill(0);
  let run = 0;
  let max = 0;
  for (let i = 0; i < buckets; i++) {
    run += delta[i]!;
    series[i] = run;
    if (run > max) max = run;
  }
  return { t0, t1, series, max };
}

// ---------------------------------------------------------------------------
// Agent iteration tree — [ITER-n] → [TOOL_CALL/RESULT/OUTPUT:name]
// ---------------------------------------------------------------------------

export interface AgentNode {
  kind: "iteration" | "tool";
  label: string;
  events: LogEvent[];
  children: AgentNode[];
  /** Set on tool nodes that repeat an identical earlier call (a failure mode). */
  repeated?: boolean;
}

interface Marker {
  t: "iter" | "call" | "result" | "output";
  name: string;
}

function agentMarker(text: string): Marker | null {
  let m: RegExpExecArray | null;
  if ((m = /\[ITER[-_ ]?(\d+)\]/i.exec(text))) return { t: "iter", name: m[1]! };
  if ((m = /\[TOOL_CALL:([^\]]+)\]/i.exec(text))) return { t: "call", name: m[1]!.trim() };
  if ((m = /\[TOOL_RESULT:([^\]]+)\]/i.exec(text))) return { t: "result", name: m[1]!.trim() };
  if ((m = /\[TOOL_OUTPUT:([^\]]+)\]/i.exec(text))) return { t: "output", name: m[1]!.trim() };
  return null;
}

/**
 * Render agent-pipeline logs as a nested tree: iteration → tool call → result.
 * Repeated identical tool calls (same tool + same first-event text) are flagged.
 * Returns `null` when no agent markers are present.
 */
export function agentTree(events: LogEvent[]): AgentNode[] | null {
  const iterations: AgentNode[] = [];
  let cur: AgentNode | null = null;
  let curTool: AgentNode | null = null;
  let sawMarker = false;

  const makeIter = (label: string): AgentNode => {
    const node: AgentNode = { kind: "iteration", label, events: [], children: [] };
    iterations.push(node);
    return node;
  };

  for (const e of events) {
    const mk = agentMarker(e.text) ?? agentMarker(e.title);
    if (mk) sawMarker = true;

    if (mk?.t === "iter") {
      cur = makeIter(`Iteration ${mk.name}`);
      curTool = null;
      cur.events.push(e);
      continue;
    }
    if (mk && (mk.t === "call" || mk.t === "result" || mk.t === "output")) {
      if (!cur) {
        cur = makeIter("Iteration 1");
        curTool = null;
      }
      if (!curTool || curTool.label !== mk.name || mk.t === "call") {
        curTool = { kind: "tool", label: mk.name, events: [], children: [] };
        cur.children.push(curTool);
      }
      curTool.events.push(e);
      continue;
    }
    // Non-marker event attaches to the current context.
    if (curTool) curTool.events.push(e);
    else if (cur) cur.events.push(e);
  }

  if (!sawMarker) return null;

  // Flag repeated identical tool calls (same tool + same first-event text).
  const seen = new Map<string, number>();
  for (const iter of iterations) {
    for (const tool of iter.children) {
      const sig = tool.label + SEQ_SEP + (tool.events[0]?.text ?? "");
      const n = (seen.get(sig) ?? 0) + 1;
      seen.set(sig, n);
      if (n > 1) tool.repeated = true;
    }
  }
  return iterations;
}
