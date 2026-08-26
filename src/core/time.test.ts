import { describe, expect, it } from "vitest";
import { formatGap, formatTime, parseTimestamp } from "./time.ts";

describe("parseTimestamp", () => {
  const iso = Date.UTC(2026, 7, 21, 10, 29, 23, 36);
  const noMs = Date.UTC(2026, 7, 21, 10, 29, 23, 0);

  const cases: Array<[string, unknown, number | null]> = [
    ["ISO 8601 with Z", "2026-08-21T10:29:23.036Z", iso],
    ["Python comma-millis", "2026-08-21 10:29:23,036", iso],
    ["space-separated, no tz (assume UTC)", "2026-08-21 10:29:23", noMs],
    ["ISO with explicit offset", "2026-08-21T16:29:23+06:00", Date.UTC(2026, 7, 21, 10, 29, 23, 0)],
    ["epoch seconds (number)", 1_755_770_000, 1_755_770_000_000],
    ["epoch millis (number)", 1_755_770_000_000, 1_755_770_000_000],
    ["epoch millis (numeric string)", "1755770000000", 1_755_770_000_000],
    ["epoch seconds (numeric string)", "1755770000", 1_755_770_000_000],
    ["small number is not an epoch", 12345, null],
    ["unparseable text", "not a date", null],
    ["empty string", "", null],
    ["null", null, null],
    ["undefined", undefined, null],
    ["NaN", NaN, null],
  ];

  it.each(cases)("%s", (_label, input, expected) => {
    expect(parseTimestamp(input)).toBe(expected);
  });
});

describe("formatTime — 12-hour edge cases", () => {
  // IST midnight = UTC 18:30 the previous day; date must roll forward.
  const istMidnight = Date.UTC(2026, 7, 20, 18, 30, 0, 0);
  // IST noon = UTC 06:30.
  const istNoon = Date.UTC(2026, 7, 21, 6, 30, 0, 0);
  // IST 15:30 = UTC 10:00 → "03:30 PM".
  const istAfternoon = Date.UTC(2026, 7, 21, 10, 0, 0, 0);

  it("midnight is 12:00:00 AM, not 00:00 AM, and rolls the date forward", () => {
    expect(formatTime(istMidnight, "ist")).toBe("2026-08-21 12:00:00.000 AM");
  });

  it("noon is 12:00:00 PM", () => {
    expect(formatTime(istNoon, "ist")).toBe("2026-08-21 12:00:00.000 PM");
  });

  it("afternoon uses PM with a 1-12 hour", () => {
    expect(formatTime(istAfternoon, "ist")).toBe("2026-08-21 03:30:00.000 PM");
  });

  it("ist24 uses a 24-hour clock", () => {
    expect(formatTime(istAfternoon, "ist24")).toBe("2026-08-21 15:30:00.000");
  });

  it("utc mode uses no offset", () => {
    expect(formatTime(istAfternoon, "utc")).toBe("2026-08-21 10:00:00.000");
  });
});

describe("formatTime — relative", () => {
  const base = Date.UTC(2026, 7, 21, 10, 0, 0, 0);
  it("formats sub-minute offsets in seconds", () => {
    expect(formatTime(base + 1500, "rel", base)).toBe("+1.500s");
    expect(formatTime(base - 250, "rel", base)).toBe("-0.250s");
  });
  it("formats minute+ offsets", () => {
    expect(formatTime(base + 65000, "rel", base)).toBe("+1m 5.0s");
  });
  it("defaults base to the value itself", () => {
    expect(formatTime(base, "rel")).toBe("+0.000s");
  });
});

describe("formatGap", () => {
  const cases: Array<[number | null, string]> = [
    [null, ""],
    [0, "0ms"],
    [500, "500ms"],
    [1500, "1.50s"],
    [65000, "1m05s"],
  ];
  it.each(cases)("%s → %s", (input, expected) => {
    expect(formatGap(input)).toBe(expected);
  });
});
