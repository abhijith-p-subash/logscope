import { describe, expect, it } from "vitest";
import { parseCSV, parseFile, tryJSON } from "./parse.ts";

describe("tryJSON", () => {
  it("parses objects and arrays, rejects scalars and garbage", () => {
    expect(tryJSON('{"a":1}')).toEqual({ a: 1 });
    expect(tryJSON("[1,2]")).toEqual([1, 2]);
    expect(tryJSON("42")).toBeNull();
    expect(tryJSON("nope")).toBeNull();
  });
});

describe("parseCSV", () => {
  it("handles quoted cells with escaped double-quotes and embedded JSON", () => {
    const text = '@message,@requestId\n"{""k"":""v"",""n"":1}",req-1\n';
    const rows = parseCSV(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]!["@message"]).toBe('{"k":"v","n":1}');
    expect(rows[0]!["@requestId"]).toBe("req-1");
  });

  it("returns [] when there is no data beyond a header", () => {
    expect(parseCSV("a,b,c\n")).toEqual([]);
  });
});

describe("parseFile — format sniffing", () => {
  it("detects a JSON array export", () => {
    const r = parseFile("x.json", '[{"timestamp":"2026-01-01T00:00:00Z","message":"hi"}]');
    expect(r.diagnostics.format).toBe("json");
    expect(r.rows).toHaveLength(1);
  });

  it("detects NDJSON when a majority of lines are JSON objects", () => {
    const r = parseFile("x.ndjson", '{"a":1}\n{"a":2}\n{"a":3}');
    expect(r.diagnostics.format).toBe("ndjson");
    expect(r.rows).toHaveLength(3);
  });

  it("unwraps the Insights results field/value shape", () => {
    const text = JSON.stringify({
      results: [[{ field: "@message", value: "hello" }, { field: "@requestId", value: "r1" }]],
    });
    const r = parseFile("x.json", text);
    expect(r.diagnostics.format).toBe("insights");
    expect(r.rows[0]).toEqual({ "@message": "hello", "@requestId": "r1" });
  });

  it("unwraps an events container", () => {
    const r = parseFile("x.json", '{"events":[{"message":"a"},{"message":"b"}]}');
    expect(r.rows).toHaveLength(2);
  });

  it("detects CSV", () => {
    const r = parseFile("x.csv", "col1,col2\na,b\n");
    expect(r.diagnostics.format).toBe("csv");
  });

  it("degrades unknown text to one message row per line, never throwing", () => {
    const r = parseFile("x.log", "line one\nline two");
    expect(r.diagnostics.format).toBe("text");
    expect(r.rows).toEqual([{ message: "line one" }, { message: "line two" }]);
  });

  it("handles an empty file with a warning and no rows", () => {
    const r = parseFile("empty.json", "");
    expect(r.rows).toEqual([]);
    expect(r.diagnostics.warnings.length).toBeGreaterThan(0);
  });
});

describe("parseFile — Insights truncation warning", () => {
  it("warns when a file has exactly 10,000 rows (likely the Insights cap)", () => {
    const lines: string[] = [];
    for (let i = 0; i < 10000; i++) lines.push(JSON.stringify({ message: "row " + i }));
    const r = parseFile("big.ndjson", lines.join("\n"));
    expect(r.rows).toHaveLength(10000);
    expect(r.diagnostics.truncated).toBe(true);
    expect(r.diagnostics.warnings.join(" ")).toMatch(/cap|incomplete/i);
  });

  it("does not warn for 9,999 rows", () => {
    const lines: string[] = [];
    for (let i = 0; i < 9999; i++) lines.push(JSON.stringify({ message: "row " + i }));
    const r = parseFile("big.ndjson", lines.join("\n"));
    expect(r.diagnostics.truncated).toBe(false);
  });
});
