import { buildMatcher, LEVEL_ORDER } from "@core/index.ts";
import type { Level, LogEvent } from "@core/index.ts";
import type { TimeMode } from "@core/index.ts";

export type TZ = TimeMode;
export type SortKey = "t" | "-t" | "-lv" | "-el";

export interface Filters {
  q: string;
  levels: Set<Level>;
  rid: string | null;
  sig: string | null;
  range: [number, number] | null;
  offFiles: Set<string>;
}

export const emptyFilters = (): Filters => ({
  q: "",
  levels: new Set(),
  rid: null,
  sig: null,
  range: null,
  offFiles: new Set(),
});

/**
 * Apply all active filters and sorting to produce the visible event list.
 * Filters are composable; a `null`/empty filter is a pass-through. This mirrors
 * the reference prototype's `apply()`.
 */
export function computeView(events: LogEvent[], f: Filters, sort: SortKey): LogEvent[] {
  const match = buildMatcher(f.q);
  const out: LogEvent[] = [];
  for (const e of events) {
    if (f.offFiles.has(e.file)) continue;
    if (f.levels.size && !f.levels.has(e.level)) continue;
    if (f.rid && e.rid !== f.rid) continue;
    if (f.sig && e.sig !== f.sig) continue;
    if (f.range && (e.t < f.range[0] || e.t > f.range[1])) continue;
    if (match && !match(e)) continue;
    out.push(e);
  }

  const dir = sort.startsWith("-") ? -1 : 1;
  const key = sort.replace("-", "");
  if (key === "lv") {
    out.sort((a, b) => (LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]) * dir || a.t - b.t);
  } else if (key === "el") {
    out.sort((a, b) => ((b.el ?? 0) - (a.el ?? 0)) * dir);
  } else {
    out.sort((a, b) => (a.t - b.t) * dir || a.id - b.id);
  }
  return out;
}
