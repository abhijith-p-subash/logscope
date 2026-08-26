/**
 * Timestamp parsing and formatting.
 *
 * Golden rule (CLAUDE.md): never store a formatted string. Store UTC epoch
 * milliseconds and format only at render. Return `null` for anything
 * unparseable rather than guessing.
 */

/** IST offset from UTC, in minutes (UTC+5:30). */
export const IST_OFFSET_MIN = 330;

export type TimeMode = "ist" | "ist24" | "local" | "utc" | "rel";

const p2 = (n: number): string => String(n).padStart(2, "0");
const p3 = (n: number): string => String(n).padStart(3, "0");

/**
 * Parse a timestamp value into UTC epoch milliseconds, or `null`.
 *
 * Accepts (per CLAUDE.md):
 *  - ISO 8601 with `Z` or explicit offset
 *  - Python comma-millis: `2026-08-21 10:29:23,036`
 *  - space-separated without timezone (assumed UTC)
 *  - epoch seconds / epoch milliseconds (number or numeric string)
 *
 * Values below ~1e9 are rejected: they are ambiguous and more likely a small
 * integer field than a real epoch. Better to return null than guess.
 */
export function parseTimestamp(v: unknown): number | null {
  if (v == null || v === "") return null;

  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return v > 1e12 ? v : v > 1e9 ? v * 1000 : null;
  }

  const s = String(v).trim();
  if (s === "") return null;

  // Pure integer string → epoch seconds or milliseconds.
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n > 1e12 ? n : n > 1e9 ? n * 1000 : null;
  }

  // Python comma-millis: replace the first ",ddd" with ".ddd".
  let t = s.replace(/,(\d{3})/, ".$1");

  // `YYYY-MM-DD HH:MM:SS` with no timezone → assume UTC.
  if (/^\d{4}-\d{2}-\d{2} /.test(t) && !/[Zz]|[+-]\d{2}:\d{2}$/.test(t)) {
    t = t.replace(" ", "T") + "Z";
  }

  const p = Date.parse(t);
  return Number.isNaN(p) ? null : p;
}

interface DateParts {
  y: number;
  mo: number;
  da: number;
  h: number;
  mi: number;
  s: number;
  ms: number;
}

/** Break an epoch-ms value into calendar parts at a given minute offset from UTC. */
function partsAt(ms: number, offMin: number): DateParts {
  const d = new Date(ms + offMin * 60000);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    da: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds(),
  };
}

/**
 * Format an epoch-ms timestamp as a plain string (no markup).
 *
 * 12-hour edge cases (the classic hand-rolled bug): midnight is `12:00:00 AM`
 * and belongs to the day that just started; noon is `12:00:00 PM`. There is no
 * `00:00 AM`.
 *
 * @param base reference time for `rel` mode (defaults to `ms` → `+0.000s`).
 */
export function formatTime(ms: number, mode: TimeMode, base?: number): string {
  if (mode === "rel") {
    const d = ms - (base ?? ms);
    const sign = d < 0 ? "-" : "+";
    const sec = Math.abs(d) / 1000;
    if (sec < 60) return sign + sec.toFixed(3) + "s";
    const m = Math.floor(sec / 60);
    const r = (sec % 60).toFixed(1);
    return sign + m + "m " + r + "s";
  }

  let off: number;
  if (mode === "utc") off = 0;
  else if (mode === "local") off = -new Date(ms).getTimezoneOffset();
  else off = IST_OFFSET_MIN; // ist, ist24

  const p = partsAt(ms, off);
  const date = `${p.y}-${p2(p.mo)}-${p2(p.da)}`;
  const frac = p3(p.ms);

  if (mode === "ist") {
    const ampm = p.h < 12 ? "AM" : "PM";
    let h12 = p.h % 12;
    if (h12 === 0) h12 = 12;
    return `${date} ${p2(h12)}:${p2(p.mi)}:${p2(p.s)}.${frac} ${ampm}`;
  }

  // ist24, local, utc
  return `${date} ${p2(p.h)}:${p2(p.mi)}:${p2(p.s)}.${frac}`;
}

/** Human-readable duration for a gap in milliseconds. `null` → empty string. */
export function formatGap(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return ms + "ms";
  if (ms < 60000) return (ms / 1000).toFixed(2) + "s";
  return Math.floor(ms / 60000) + "m" + p2(Math.round((ms % 60000) / 1000)) + "s";
}
