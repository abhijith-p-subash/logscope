import { describe, expect, it } from "vitest";
import { buildEvidenceBundle } from "./report.ts";
import { defaultRedaction } from "./redact.ts";
import type { LogEvent } from "./model.ts";

const ev = (over: Partial<LogEvent>): LogEvent => ({
  id: 0,
  t: Date.UTC(2026, 7, 21, 4, 30, 0),
  hasTime: true,
  frags: 1,
  level: "error",
  rid: "req-1",
  title: "payment failed for jane@example.com",
  payload: { customerId: "cust-999", amount: 42 },
  parsed: true,
  text: "payment failed",
  file: "f.json",
  sig: null,
  el: null,
  ...over,
});

describe("buildEvidenceBundle", () => {
  const html = buildEvidenceBundle([ev({})], {
    title: "Defect 1234",
    filter: "error",
    sources: ["export.json"],
    redact: defaultRedaction(),
    now: Date.UTC(2026, 7, 21, 5, 0, 0),
  });

  it("produces a self-contained document with no external resources", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("includes dual IST/UTC timestamps and the metadata", () => {
    expect(html).toContain("Defect 1234");
    expect(html).toContain("2026-08-21T04:30:00.000Z"); // UTC
    expect(html).toContain("filter: error");
    expect(html).toContain("Sources: export.json");
    expect(html).toContain("PII redacted");
  });

  it("applies redaction to the rendered content", () => {
    expect(html).not.toContain("jane@example.com");
    expect(html).toContain("‹email›");
    expect(html).toContain("‹redacted›"); // customerId field
  });

  it("escapes HTML in event content", () => {
    const evil = buildEvidenceBundle([ev({ title: "<script>alert(1)</script>", payload: null, parsed: false, redact: null } as never)], {});
    expect(evil).not.toContain("<script>alert(1)</script>");
    expect(evil).toContain("&lt;script&gt;");
  });
});
