import { describe, expect, it } from "vitest";
import { defaultRedaction, previewRedaction, redactString, redactValue } from "./redact.ts";
import type { LogEvent } from "./model.ts";

const cfg = defaultRedaction();

describe("redactString", () => {
  it("redacts emails and long digit runs", () => {
    expect(redactString("contact jane.doe@example.com now", cfg.rules)).toBe("contact ‹email› now");
    expect(redactString("account 123456789 flagged", cfg.rules)).toBe("account ‹num› flagged");
  });

  it("leaves short numbers alone", () => {
    expect(redactString("code 200 ok", cfg.rules)).toBe("code 200 ok");
  });
});

describe("redactValue", () => {
  it("redacts sensitive id-field values wholesale, recursively", () => {
    const out = redactValue(
      { email: "a@b.com", nested: { password: "hunter2", note: "call 987654321" }, ok: true },
      cfg,
    ) as Record<string, unknown>;
    expect(out.email).toBe("‹redacted›");
    expect((out.nested as Record<string, unknown>).password).toBe("‹redacted›");
    expect((out.nested as Record<string, unknown>).note).toBe("call ‹num›");
    expect(out.ok).toBe(true);
  });

  it("does not mutate the input", () => {
    const input = { email: "a@b.com" };
    redactValue(input, cfg);
    expect(input.email).toBe("a@b.com");
  });
});

describe("previewRedaction", () => {
  it("counts changed events and collects samples", () => {
    const events = [
      { title: "user a@b.com logged in" },
      { title: "nothing sensitive here" },
    ] as LogEvent[];
    const p = previewRedaction(events, cfg);
    expect(p.changed).toBe(1);
    expect(p.samples[0]!.after).toContain("‹email›");
  });
});
