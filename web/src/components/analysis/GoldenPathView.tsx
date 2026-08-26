import { goldenPath, type Trace } from "@core/index.ts";

/** Shows the modal trace shape and every request that deviates from it. */
export function GoldenPathView({ traces, onPickRid }: { traces: Trace[]; onPickRid: (rid: string) => void }) {
  const gp = goldenPath(traces);

  return (
    <div style={{ overflow: "auto", padding: "10px 14px", flex: 1 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, marginBottom: 4, color: "var(--dim)" }}>
        GOLDEN PATH · {gp.support} of {traces.length} requests match ({gp.shape.length} steps)
      </div>
      <ol style={{ margin: "0 0 16px 20px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)" }}>
        {gp.shape.map((s, i) => (
          <li key={i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 700 }}>
            {s}
          </li>
        ))}
      </ol>

      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, marginBottom: 6, color: "var(--dim)" }}>
        DEVIATIONS ({gp.deviations.length})
      </div>
      {gp.deviations.length === 0 ? (
        <div className="empty">Every request follows the golden path.</div>
      ) : (
        gp.deviations.map((d) => (
          <button
            key={d.rid}
            className="sitem"
            style={{ display: "block", padding: "5px 8px", borderBottom: "1px solid var(--line)" }}
            onClick={() => onPickRid(d.rid)}
            title="Filter to this request"
          >
            <span style={{ color: "var(--violet)" }}>{d.rid}</span>
            {d.reordered && <span style={{ color: "var(--amber)", marginLeft: 8 }}>reordered</span>}
            {d.missing.length > 0 && (
              <span style={{ color: "var(--rose)", marginLeft: 8 }}>−{d.missing.length} missing</span>
            )}
            {d.extra.length > 0 && (
              <span style={{ color: "var(--green)", marginLeft: 8 }}>+{d.extra.length} extra</span>
            )}
          </button>
        ))
      )}
    </div>
  );
}
