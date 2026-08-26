import { waterfall, type Trace } from "@core/index.ts";
import { formatGap, type TimeMode } from "../../lib/format.ts";
import { TimeText } from "../TimeText.tsx";

/** Horizontal timeline of a trace's steps, with the slowest segment highlighted. */
export function Waterfall({ trace, tz }: { trace: Trace; tz: TimeMode }) {
  const w = waterfall(trace);
  const total = Math.max(1, w.totalMs);

  // Dwell = time from each step until the next; the widest is where time went.
  const dwell = w.steps.map((s, i) =>
    i + 1 < w.steps.length ? w.steps[i + 1]!.offsetMs - s.offsetMs : 0,
  );
  const maxDwell = Math.max(...dwell, 0);
  const slowIndex = maxDwell > 0 ? dwell.indexOf(maxDwell) : -1;

  return (
    <div style={{ overflow: "auto", padding: "10px 14px", flex: 1 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, marginBottom: 10 }}>
        request <span style={{ color: "var(--violet)" }}>{trace.rid}</span> ·{" "}
        <b>{formatGap(trace.duration)}</b> · {trace.events.length} steps
        {slowIndex >= 0 && (
          <>
            {" "}
            · slowest step <span style={{ color: "var(--amber)" }}>{formatGap(maxDwell)}</span>
          </>
        )}
      </div>
      {w.steps.map((s, i) => {
        const leftPct = (s.offsetMs / total) * 100;
        const widthPct = Math.max(0.6, (dwell[i]! / total) * 100);
        const slow = i === slowIndex;
        return (
          <div
            key={s.event.id}
            style={{ display: "flex", alignItems: "center", gap: 10, height: 24, fontFamily: "var(--mono)", fontSize: 11 }}
          >
            <span style={{ width: 150, flexShrink: 0, color: "var(--faint)" }}>
              <TimeText t={s.event.t} tz={tz} base={trace.start} />
            </span>
            <span className={"lv " + s.event.level} style={{ width: 44, flexShrink: 0, fontSize: 9.5, fontWeight: 600 }}>
              {s.event.level.toUpperCase()}
            </span>
            <div style={{ position: "relative", flex: 1, height: 12, background: "var(--panel2)", borderRadius: 3 }}>
              <div
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: 0,
                  bottom: 0,
                  background: slow ? "var(--amber)" : "var(--cyan)",
                  opacity: slow ? 0.9 : 0.55,
                  borderRadius: 3,
                }}
                title={`+${formatGap(s.offsetMs)}${dwell[i] ? " · dwell " + formatGap(dwell[i]!) : ""}`}
              />
            </div>
            <span
              style={{
                width: "38%",
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: slow ? "var(--amber)" : "var(--fg)",
              }}
              title={s.event.title}
            >
              {s.event.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}
