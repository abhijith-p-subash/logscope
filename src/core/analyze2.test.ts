import { describe, expect, it } from "vitest";
import { agentTree, concurrency, diffPayloads, diffTraces, goldenPath, waterfall } from "./analyze.ts";
import type { LogEvent, Trace } from "./model.ts";

let idSeq = 0;
const ev = (t: number, title: string, opts: Partial<LogEvent> = {}): LogEvent => ({
  id: idSeq++,
  t,
  hasTime: true,
  frags: 1,
  level: "info",
  rid: opts.rid ?? "r",
  title,
  payload: opts.payload ?? null,
  parsed: opts.payload != null,
  text: opts.text ?? title,
  file: "f",
  sig: null,
  el: null,
  ...opts,
});

const trace = (rid: string, events: LogEvent[]): Trace => ({
  rid,
  events,
  start: events[0]!.t,
  end: events[events.length - 1]!.t,
  duration: events[events.length - 1]!.t - events[0]!.t,
  errorCount: events.filter((e) => e.level === "error").length,
});

describe("waterfall", () => {
  it("computes offsets and flags the largest gap", () => {
    const t = trace("r", [ev(1000, "start"), ev(1100, "fast"), ev(9000, "slow step")]);
    const w = waterfall(t);
    expect(w.totalMs).toBe(8000);
    expect(w.steps.map((s) => s.offsetMs)).toEqual([0, 100, 8000]);
    expect(w.steps.map((s) => s.gapMs)).toEqual([0, 100, 7900]);
    expect(w.largestGapIndex).toBe(2); // the 7.9s jump
  });

  it("reports no largest gap when steps are simultaneous", () => {
    const t = trace("r", [ev(1000, "a"), ev(1000, "b")]);
    expect(waterfall(t).largestGapIndex).toBe(-1);
  });
});

describe("diffPayloads", () => {
  it("finds field-level changes by dotted path", () => {
    const changes = diffPayloads({ a: 1, b: { c: 2 }, d: 3 }, { a: 1, b: { c: 9 }, e: 4 });
    const paths = changes.map((c) => c.path);
    expect(paths).toContain("b.c");
    expect(paths).toContain("d");
    expect(paths).toContain("e");
    expect(paths).not.toContain("a");
  });
});

describe("diffTraces", () => {
  it("aligns shared steps and marks missing / changed ones", () => {
    const pass = trace("pass", [
      ev(1, "validate input", { payload: { ok: true } }),
      ev(2, "call service"),
      ev(3, "return 200"),
    ]);
    const fail = trace("fail", [
      ev(1, "validate input", { payload: { ok: false } }),
      ev(3, "return 500"),
    ]);
    const rows = diffTraces(pass, fail);
    const statuses = rows.map((r) => r.status);
    // "validate input" changed (payload differs), "call service" only in pass.
    expect(statuses).toContain("changed");
    expect(statuses).toContain("only-a");
    const changed = rows.find((r) => r.status === "changed")!;
    expect(changed.changes.some((c) => c.path === "ok")).toBe(true);
  });
});

describe("goldenPath", () => {
  it("derives the modal shape and flags a deviating trace", () => {
    const mk = (rid: string, titles: string[]) => trace(rid, titles.map((tt, i) => ev(i + 1, tt, { rid })));
    const traces = [
      mk("a", ["start", "auth", "query", "done"]),
      mk("b", ["start", "auth", "query", "done"]),
      mk("c", ["start", "auth", "done"]), // missing "query"
    ];
    const gp = goldenPath(traces);
    expect(gp.shape).toEqual(["start", "auth", "query", "done"]);
    expect(gp.support).toBe(2);
    expect(gp.deviations).toHaveLength(1);
    expect(gp.deviations[0]!.rid).toBe("c");
    expect(gp.deviations[0]!.missing).toContain("query");
  });

  it("returns step-shaped (not per-character) output (C6 — real delimiter)", () => {
    // The shape must be an array of step keys, not the joined key split into
    // characters. Guards against SEQ_SEP being an empty string.
    const mk = (rid: string, titles: string[]) => trace(rid, titles.map((tt, i) => ev(i + 1, tt, { rid })));
    const gp = goldenPath([mk("a", ["alpha", "beta", "gamma"]), mk("b", ["alpha", "beta", "gamma"])]);
    expect(gp.shape).toEqual(["alpha", "beta", "gamma"]);
    expect(gp.shape).toHaveLength(3); // 3 steps, not 14 characters
  });
});

describe("concurrency", () => {
  it("counts overlapping traces", () => {
    const traces = [trace("a", [ev(0, "x"), ev(100, "y")]), trace("b", [ev(50, "x"), ev(150, "y")])];
    const c = concurrency(traces, 10);
    expect(c.t0).toBe(0);
    expect(c.t1).toBe(150);
    expect(c.max).toBe(2); // the two overlap in the middle
  });

  it("does not crash on a very large trace count (C5 — no arg-spread)", () => {
    // `Math.min(...traces)` threw RangeError past the argument limit; this many
    // traces exercises the reduce + prefix-sum path instead.
    const traces = Array.from({ length: 150_000 }, (_, i) =>
      trace("r" + i, [ev(i, "a"), ev(i + 10, "b")]),
    );
    let c!: ReturnType<typeof concurrency>;
    expect(() => { c = concurrency(traces, 200); }).not.toThrow();
    expect(c.series).toHaveLength(200);
    expect(c.max).toBeGreaterThan(0);
  });
});

describe("agentTree", () => {
  it("returns null when there are no agent markers", () => {
    expect(agentTree([ev(1, "just a normal log")])).toBeNull();
  });

  it("nests iterations and tools, flagging repeated identical calls", () => {
    const events = [
      ev(1, "[ITER-1] planning"),
      ev(2, "[TOOL_CALL:search] query=weather", { text: "[TOOL_CALL:search] query=weather" }),
      ev(3, "[TOOL_RESULT:search] 3 hits", { text: "[TOOL_RESULT:search] 3 hits" }),
      ev(4, "[ITER-2] retry"),
      ev(5, "[TOOL_CALL:search] query=weather", { text: "[TOOL_CALL:search] query=weather" }),
    ];
    const tree = agentTree(events)!;
    expect(tree).toHaveLength(2);
    expect(tree[0]!.label).toBe("Iteration 1");
    expect(tree[0]!.children[0]!.label).toBe("search");
    // The identical search call in iteration 2 is flagged as repeated.
    expect(tree[1]!.children[0]!.repeated).toBe(true);
  });
});
