import { describe, expect, it } from "vitest";
import { buildMatcher, escapeHtml, highlight } from "./search.ts";
import type { LogEvent } from "./model.ts";

const ev = (text: string, over: Partial<LogEvent> = {}): LogEvent => ({
  id: 0, t: 0, hasTime: true, frags: 1, level: "info", rid: null,
  title: text, payload: null, parsed: false, text, file: "f", sig: null, el: null,
  ...over,
});

describe("buildMatcher", () => {
  it("returns null for an empty query (matches everything)", () => {
    expect(buildMatcher("   ")).toBeNull();
  });

  it("ANDs bare terms", () => {
    const m = buildMatcher("payment declined")!;
    expect(m(ev("payment was declined"))).toBe(true);
    expect(m(ev("payment approved"))).toBe(false);
  });

  it("excludes -terms", () => {
    const m = buildMatcher("error -timeout")!;
    expect(m(ev("error: bad input"))).toBe(true);
    expect(m(ev("error: timeout"))).toBe(false);
  });

  it("matches quoted phrases literally", () => {
    const m = buildMatcher('"connection refused"')!;
    expect(m(ev("db connection refused now"))).toBe(true);
    expect(m(ev("connection was refused"))).toBe(false);
  });

  it("supports /regex/ queries", () => {
    const m = buildMatcher("/e\\d{3}/")!;
    expect(m(ev("code E500 seen"))).toBe(true);
    expect(m(ev("no code"))).toBe(false);
  });

  it("degrades invalid regex to literal search without throwing", () => {
    const m = buildMatcher("/(unclosed/")!;
    expect(() => m(ev("x"))).not.toThrow();
    // Falls back to a literal search of the raw query (matching the reference impl).
    expect(m(ev("contains /(unclosed/ literally"))).toBe(true);
    expect(m(ev("no match here"))).toBe(false);
  });

  it("OR-groups match if any group matches", () => {
    const m = buildMatcher("timeout | refused")!;
    expect(m(ev("connection timeout"))).toBe(true);
    expect(m(ev("connection refused"))).toBe(true);
    expect(m(ev("connection ok"))).toBe(false);
  });

  it("OR keyword works the same as |", () => {
    const m = buildMatcher("cat OR dog")!;
    expect(m(ev("a dog barks"))).toBe(true);
    expect(m(ev("a bird sings"))).toBe(false);
  });

  it("scopes to direct fields", () => {
    const m = buildMatcher("level:error")!;
    expect(m(ev("boom", { level: "error" }))).toBe(true);
    expect(m(ev("boom", { level: "info" }))).toBe(false);
  });

  it("negates a field term", () => {
    const m = buildMatcher("-file:noisy.log")!;
    expect(m(ev("x", { file: "clean.json" }))).toBe(true);
    expect(m(ev("x", { file: "noisy.log" }))).toBe(false);
  });

  it("searches payload by key for unknown fields", () => {
    const m = buildMatcher("status:500")!;
    expect(m(ev("req", { payload: { status: 500 }, parsed: true }))).toBe(true);
    expect(m(ev("req", { payload: { status: 200 }, parsed: true }))).toBe(false);
  });

  it("searches nested payload keys (depth-limited)", () => {
    const m = buildMatcher("userId:abc123")!;
    expect(m(ev("req", { payload: { ctx: { userId: "abc123" } }, parsed: true }))).toBe(true);
  });

  it("treats scheme-like tokens (http://) as literal text, not a field", () => {
    const m = buildMatcher("http://api.local")!;
    expect(m(ev("GET http://api.local/health"))).toBe(true);
    expect(m(ev("GET https://other/health"))).toBe(false);
  });
});

describe("highlight — HTML safety", () => {
  it("escapes HTML before applying <mark> (XSS vector)", () => {
    const out = highlight('<script>alert(1)</script> failed', "failed");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("<mark>failed</mark>");
  });

  it("escaping a matched term cannot inject markup", () => {
    const out = highlight("value is <b>bold</b>", "<b>");
    expect(out).not.toContain("<b>bold");
    expect(out).toContain("<mark>&lt;b&gt;</mark>");
  });

  it("highlights regex matches safely (escapes, then marks)", () => {
    const out = highlight("<i>x</i>", "/x/");
    // The `x` is marked, but the surrounding tags stay escaped — no raw markup.
    expect(out).not.toContain("<i>");
    expect(out).toContain("&lt;i&gt;");
    expect(out).toContain("<mark>x</mark>");
  });

  it("highlights field-scoped values", () => {
    const out = highlight("status was 500 today", "status:500");
    expect(out).toContain("<mark>500</mark>");
  });
});

describe("escapeHtml", () => {
  it("escapes the five significant characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});
