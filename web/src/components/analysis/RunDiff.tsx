import { useState } from "react";
import { diffTraces, type Trace } from "@core/index.ts";

const STATUS_COLOR: Record<string, string> = {
  same: "var(--faint)",
  changed: "var(--amber)",
  "only-a": "var(--rose)",
  "only-b": "var(--green)",
};

/** Select two requests and compare them step-by-step, with payload diffs. */
export function RunDiff({ traces, initial }: { traces: Trace[]; initial: string | null }) {
  const rids = traces.map((t) => t.rid);
  const [a, setA] = useState<string>(initial ?? rids[0] ?? "");
  const [b, setB] = useState<string>(rids.find((r) => r !== (initial ?? rids[0])) ?? rids[1] ?? "");

  const ta = traces.find((t) => t.rid === a);
  const tb = traces.find((t) => t.rid === b);

  const Select = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select className="sel" value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 260 }}>
      {rids.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );

  return (
    <div style={{ overflow: "auto", padding: "10px 14px", flex: 1 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ color: "var(--rose)" }}>A</span> <Select value={a} onChange={setA} />
        <span style={{ color: "var(--green)" }}>B</span> <Select value={b} onChange={setB} />
      </div>
      {!ta || !tb ? (
        <div className="empty">Select two requests to compare.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--mono)", fontSize: 11 }}>
          <tbody>
            {diffTraces(ta, tb).map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ width: 66, color: STATUS_COLOR[row.status], padding: "4px 8px", verticalAlign: "top" }}>
                  {row.status}
                </td>
                <td style={{ padding: "4px 8px", verticalAlign: "top", width: "40%" }} title={row.a?.title}>
                  {row.a?.title ?? <span style={{ color: "var(--faint)" }}>—</span>}
                </td>
                <td style={{ padding: "4px 8px", verticalAlign: "top", width: "40%" }} title={row.b?.title}>
                  {row.b?.title ?? <span style={{ color: "var(--faint)" }}>—</span>}
                  {row.changes.length > 0 && (
                    <div style={{ marginTop: 3, color: "var(--amber)", fontSize: 10 }}>
                      {row.changes.slice(0, 6).map((c) => (
                        <div key={c.path}>
                          {c.path}: {JSON.stringify(c.a)} → {JSON.stringify(c.b)}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
