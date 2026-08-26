import { describe, expect, it } from "vitest";
import { buildTraces, extractRid, findKey, RID_KEYS } from "./correlate.ts";
import type { LogEvent } from "./model.ts";

describe("findKey", () => {
  it("prefers @requestId over lower-priority keys at the same level", () => {
    const o = { traceId: "t-1", "@requestId": "r-1" };
    expect(findKey(o, RID_KEYS)).toBe("r-1");
  });

  it("searches nested objects", () => {
    const o = { a: { b: { correlationId: "c-9" } } };
    expect(findKey(o, RID_KEYS)).toBe("c-9");
  });

  it("stops past depth 4", () => {
    const deep = { a: { b: { c: { d: { e: { requestId: "too-deep" } } } } } };
    expect(findKey(deep, RID_KEYS)).toBeNull();
  });

  it("ignores non-string and empty values", () => {
    expect(findKey({ requestId: 123 }, RID_KEYS)).toBeNull();
    expect(findKey({ requestId: "" }, RID_KEYS)).toBeNull();
  });
});

describe("extractRid", () => {
  it("reads from the payload first", () => {
    expect(extractRid({ requestId: "p-1" }, undefined, "")).toBe("p-1");
  });

  it("falls back to an @requestId column on the raw row", () => {
    expect(extractRid(null, { "@requestId": "col-1" }, "")).toBe("col-1");
  });

  it("falls back to a regex over raw text", () => {
    expect(extractRid(null, undefined, 'blah "trace_id": "tx-42" blah')).toBe("tx-42");
  });

  it("returns null when nothing matches", () => {
    expect(extractRid(null, undefined, "no ids here")).toBeNull();
  });
});

describe("buildTraces", () => {
  const ev = (id: number, t: number, rid: string | null, level: LogEvent["level"] = "info"): LogEvent => ({
    id, t, hasTime: true, frags: 1, level, rid, title: "", payload: null, parsed: false,
    text: "", file: "f", sig: null, el: null,
  });

  it("groups by rid, orders events, and computes duration and errorCount", () => {
    const traces = buildTraces([
      ev(0, 100, "a"),
      ev(1, 300, "a", "error"),
      ev(2, 200, "b"),
      ev(3, 150, "a"),
      ev(4, 50, null), // no rid → excluded
    ]);
    expect(traces.map((t) => t.rid)).toEqual(["a", "b"]); // ordered by start: a@100 before b@200
    const a = traces.find((t) => t.rid === "a")!;
    expect(a.events.map((e) => e.t)).toEqual([100, 150, 300]);
    expect(a.duration).toBe(200);
    expect(a.errorCount).toBe(1);
  });
});
