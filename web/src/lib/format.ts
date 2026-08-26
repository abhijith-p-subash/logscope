import { formatTime } from "@core/index.ts";
import type { TimeMode } from "@core/index.ts";

export { formatTime, formatGap } from "@core/index.ts";
export type { TimeMode } from "@core/index.ts";

/** Split a formatted timestamp so the millisecond fraction can be de-emphasized. */
export function splitMillis(s: string): [string, string, string] {
  const m = s.match(/\.\d{3}/);
  if (!m || m.index == null) return [s, "", ""];
  return [s.slice(0, m.index), m[0], s.slice(m.index + m[0].length)];
}

/** Plain (no-markup) formatted time, e.g. for the detail panel and exports. */
export function plain(ms: number, mode: TimeMode, base?: number): string {
  return formatTime(ms, mode, base);
}
