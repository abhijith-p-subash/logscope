import { describe, expect, it } from "vitest";
import { closers, makeEvent, recover, stitchRows } from "./stitch.ts";
import { parseFile } from "./parse.ts";

describe("closers", () => {
  const cases: Array<[string, string]> = [
    ['{"a":1', "}"],
    ['{"a":[1,2', "]}"],
    ["[{", "}]"],
    ['{"a":"x', '"}'], // ends mid-string → close quote then brace
    ["{}", ""],
    ['{"k":"{["}', ""], // braces inside a string do not count; structure is balanced
    ['{"brace inside string: {["', "}"], // string is closed, but the outer { is still open
  ];
  it.each(cases)("%s → %s", (input, expected) => {
    expect(closers(input)).toBe(expected);
  });
});

describe("recover", () => {
  it("scans every opener — does not cut at the first bracket in a prefix", () => {
    const s = '[INFO] agent.tools — [TOOL_RESULT:x] {"k":1}';
    const { payload, cut } = recover(s);
    expect(payload).toEqual({ k: 1 });
    expect(s[cut]).toBe("{");
  });

  it("repairs truncation by appending inferred closers", () => {
    const { payload } = recover('{"a":1,"b":{"c":2');
    expect(payload).toEqual({ a: 1, b: { c: 2 } });
  });

  it("returns null for text with no JSON", () => {
    expect(recover("just a plain log line")).toEqual({ payload: null, cut: -1 });
  });
});

describe("stitchRows — fragmented pretty-printed JSON", () => {
  const rows = parseFile("fragmented-pretty.json", frag()).rows;
  const events = stitchRows(rows, "fragmented-pretty.json");

  it("rejoins the 9 same-ms fragment rows into one event", () => {
    const stitched = events.find((e) => e.frags > 1);
    expect(stitched).toBeDefined();
    expect(stitched!.frags).toBe(9);
  });

  it("recovers nested fields intact", () => {
    const stitched = events.find((e) => e.frags > 1)!;
    expect(stitched.parsed).toBe(true);
    const p = stitched.payload as Record<string, unknown>;
    expect(p.requestId).toBe("req-abc-123");
    expect(p.elapsed_ms).toBe(1240);
    expect(p.result).toEqual({ hits: 3, items: ["a", "b", "c"] });
  });

  it("derives a title from the bracketed prefix before the JSON", () => {
    const stitched = events.find((e) => e.frags > 1)!;
    expect(stitched.title).toContain("[TOOL_RESULT:search]");
  });
});

describe("stitchRows — reversed fragment order (Insights newest-first)", () => {
  it("recovers by retrying with fragments reversed when the forward join fails", () => {
    const rows = parseFile("reversed-order.json", reversed()).rows;
    const events = stitchRows(rows, "reversed-order.json");
    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.frags).toBe(4);
    expect(e.parsed).toBe(true);
    const p = e.payload as Record<string, unknown>;
    expect(p).toEqual({ event: "done", correlationId: "trace-777", count: 42, ok: true });
    expect(e.rid).toBe("trace-777");
  });
});

describe("makeEvent — plain text", () => {
  it("keeps unparseable text as-is and marks it not parsed", () => {
    const e = makeEvent(1000, [{ message: "boom: total failure" }], "x.log", 0);
    expect(e.parsed).toBe(false);
    expect(e.payload).toBeNull();
    expect(e.title).toContain("boom");
    expect(e.level).toBe("error");
  });
});

describe("makeEvent — structured record with a plain-text message", () => {
  it("uses the record's own fields for level and rid (NDJSON)", () => {
    const row = { timestamp: "2026-08-21T00:00:00Z", level: "error", requestId: "r-9", message: "handler crashed" };
    const e = makeEvent(1000, [row], "x.ndjson", 0);
    expect(e.parsed).toBe(true);
    expect(e.level).toBe("error"); // from row.level, not keyword-sniffing "handler crashed"
    expect(e.rid).toBe("r-9");
    expect(e.title).toBe("handler crashed");
  });
});

function frag(): string {
  return JSON.stringify([
    { timestamp: "2026-08-21T10:29:22.001Z", message: '{"level":"info","requestId":"req-abc-123","message":"invoke start"}' },
    { timestamp: "2026-08-21T10:29:23.036Z", message: "[INFO] agent.tools — [TOOL_RESULT:search] {" },
    { timestamp: "2026-08-21T10:29:23.036Z", message: '  "requestId": "req-abc-123",' },
    { timestamp: "2026-08-21T10:29:23.036Z", message: '  "tool": "search",' },
    { timestamp: "2026-08-21T10:29:23.036Z", message: '  "result": {' },
    { timestamp: "2026-08-21T10:29:23.036Z", message: '    "hits": 3,' },
    { timestamp: "2026-08-21T10:29:23.036Z", message: '    "items": ["a", "b", "c"]' },
    { timestamp: "2026-08-21T10:29:23.036Z", message: "  }," },
    { timestamp: "2026-08-21T10:29:23.036Z", message: '  "elapsed_ms": 1240' },
    { timestamp: "2026-08-21T10:29:23.036Z", message: "}" },
    { timestamp: "2026-08-21T10:29:24.500Z", message: '{"level":"error","requestId":"req-abc-123","message":"tool failed: timeout after 30000ms","error":"TimeoutError"}' },
  ]);
}

function reversed(): string {
  return JSON.stringify([
    { timestamp: "2026-08-21T11:00:00.500Z", message: '"ok": true}' },
    { timestamp: "2026-08-21T11:00:00.500Z", message: '"count": 42,' },
    { timestamp: "2026-08-21T11:00:00.500Z", message: '"correlationId": "trace-777",' },
    { timestamp: "2026-08-21T11:00:00.500Z", message: '{"event": "done",' },
  ]);
}
