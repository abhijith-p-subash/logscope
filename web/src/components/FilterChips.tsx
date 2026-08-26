import type { Level } from "@core/index.ts";
import { formatGap } from "../lib/format.ts";

interface Props {
  q: string;
  levels: Set<Level>;
  rid: string | null;
  sig: string | null;
  range: [number, number] | null;
  onClearQ: () => void;
  onClearLevel: (l: Level) => void;
  onClearRid: () => void;
  onClearSig: () => void;
  onClearRange: () => void;
  onClearAll: () => void;
}

function Chip({ kind, label, onClear }: { kind: string; label: string; onClear: () => void }) {
  return (
    <span className={"chip chip-" + kind}>
      <span className="chip-lbl">{label}</span>
      <button className="chip-x" title="Remove this filter" aria-label={`Remove filter ${label}`} onClick={onClear}>✕</button>
    </span>
  );
}

/** A removable-chip summary of every active filter. Hidden when nothing is active. */
export function FilterChips({
  q, levels, rid, sig, range,
  onClearQ, onClearLevel, onClearRid, onClearSig, onClearRange, onClearAll,
}: Props) {
  const activeLevels = [...levels];
  const count =
    (q.trim() ? 1 : 0) + activeLevels.length + (rid ? 1 : 0) + (sig ? 1 : 0) + (range ? 1 : 0);
  if (count === 0) return null;

  return (
    <div className="chips" role="group" aria-label="Active filters">
      <span className="chips-label">Filters</span>
      {q.trim() && <Chip kind="q" label={`“${q.length > 32 ? q.slice(0, 32) + "…" : q}”`} onClear={onClearQ} />}
      {activeLevels.map((l) => (
        <Chip key={l} kind={"lv-" + l} label={l} onClear={() => onClearLevel(l)} />
      ))}
      {rid && <Chip kind="rid" label={`req ${rid.length > 16 ? rid.slice(0, 16) + "…" : rid}`} onClear={onClearRid} />}
      {sig && <Chip kind="sig" label={`err ${sig.length > 24 ? sig.slice(0, 24) + "…" : sig}`} onClear={onClearSig} />}
      {range && <Chip kind="range" label={`range ${formatGap(range[1] - range[0])}`} onClear={onClearRange} />}
      {count > 1 && (
        <button className="chips-clear" onClick={onClearAll}>Clear all</button>
      )}
    </div>
  );
}
