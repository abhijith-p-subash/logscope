import { formatGap, type TimeMode } from "../lib/format.ts";

interface Props {
  viewCount: number;
  total: number;
  rejoinedRows: number;
  rejoinedEvents: number;
  errorsInView: number;
  rid: string | null;
  range: [number, number] | null;
  tz: TimeMode;
  connected: boolean;
  warnings: string[];
  onHelp: () => void;
}

const TZ_LABEL: Record<TimeMode, string> = {
  ist: "IST",
  ist24: "IST 24h",
  local: "local time",
  utc: "UTC",
  rel: "relative time",
};

export function StatusBar({
  viewCount,
  total,
  rejoinedRows,
  rejoinedEvents,
  errorsInView,
  rid,
  range,
  tz,
  connected,
  warnings,
  onHelp,
}: Props) {
  return (
    <div className="st">
      <span>
        <b>{viewCount.toLocaleString()}</b> of {total.toLocaleString()} events
      </span>
      {rejoinedEvents > 0 && (
        <span>
          <b>{rejoinedRows.toLocaleString()}</b> rows rejoined into{" "}
          <b>{rejoinedEvents.toLocaleString()}</b>
        </span>
      )}
      {errorsInView > 0 && (
        <span>
          <b>{errorsInView}</b> errors in view
        </span>
      )}
      {rid && (
        <span>
          request <b>{rid.slice(0, 14)}</b>
        </span>
      )}
      {range && (
        <span>
          range <b>{formatGap(range[1] - range[0])}</b>
        </span>
      )}
      {warnings.length > 0 && (
        <span style={{ color: "var(--amber)" }} title={warnings.join("\n")}>
          ! {warnings.length} warning{warnings.length > 1 ? "s" : ""}
        </span>
      )}
      <span className="sp">
        <span className={connected ? "live" : "dead"} title={connected ? "Live — watching for new files" : "Disconnected from the local server"}>
          {connected ? "● live" : "○ offline"}
        </span>{" "}
        · {TZ_LABEL[tz]} ·{" "}
        <button className="st-help" onClick={onHelp} title="Keyboard shortcuts & search syntax">
          ? shortcuts
        </button>
      </span>
    </div>
  );
}
