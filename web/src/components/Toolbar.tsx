import { forwardRef, useState } from "react";
import type { Level } from "@core/index.ts";
import type { SortKey, TZ } from "../lib/view.ts";

const LEVELS: Level[] = ["error", "warn", "info", "debug"];

const SYNTAX: Array<[string, string]> = [
  ["payment declined", "both words (AND)"],
  ["\"exact phrase\"", "literal phrase"],
  ["-timeout", "exclude a term"],
  ["timeout | refused", "either one (OR)"],
  ["/E\\d{3}/", "regex pattern"],
  ["level:error", "scope to a field"],
  ["status:500", "search a JSON key"],
  ["file:orders.json", "one source file"],
];

interface Props {
  q: string;
  onQ: (q: string) => void;
  resultCount: number;
  levels: Set<Level>;
  levelCounts: Record<Level, number>;
  onToggleLevel: (l: Level) => void;
  tz: TZ;
  onTz: (tz: TZ) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  onExportEvidence: () => void;
  onExportShare: () => void;
  onExportJSON: () => void;
}

export const Toolbar = forwardRef<HTMLInputElement, Props>(function Toolbar(
  { q, onQ, resultCount, levels, levelCounts, onToggleLevel, tz, onTz, sort, onSort, onExportEvidence, onExportShare, onExportJSON },
  searchRef,
) {
  const [helpOpen, setHelpOpen] = useState(false);
  const active = q.trim().length > 0;

  return (
    <div className="tb">
      <div className={"search" + (active ? " active" : "")}>
        <span className="search-icon">⌕</span>
        <input
          ref={searchRef}
          type="text"
          value={q}
          placeholder="Search — words AND, -exclude, &quot;phrase&quot;, a | b, /regex/, field:value"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onQ(e.target.value)}
        />
        {active && (
          <span className="search-count" title="Rows matching the current filters">
            {resultCount.toLocaleString()}
          </span>
        )}
        {active && (
          <button className="search-clear" title="Clear search (Esc)" onClick={() => onQ("")}>
            ✕
          </button>
        )}
        <button
          className={"search-help-btn" + (helpOpen ? " on" : "")}
          title="Search syntax"
          onClick={() => setHelpOpen((v) => !v)}
          onBlur={() => setTimeout(() => setHelpOpen(false), 150)}
        >
          ?
        </button>
        {helpOpen && (
          <div className="search-help">
            <div className="search-help-hd">Search syntax</div>
            {SYNTAX.map(([ex, desc]) => (
              <button
                key={ex}
                className="search-help-row"
                onMouseDown={(e) => { e.preventDefault(); onQ(q ? q + " " + ex : ex); }}
                title="Click to insert"
              >
                <code>{ex}</code>
                <span>{desc}</span>
              </button>
            ))}
            <div className="search-help-ft">Invalid regex falls back to a literal search — it never errors.</div>
          </div>
        )}
      </div>
      <div className="pills">
        {LEVELS.map((l) => (
          <button
            key={l}
            className={"pill " + l + (levels.has(l) ? " on" : "")}
            onClick={() => onToggleLevel(l)}
          >
            {l}
            <span className="n">{levelCounts[l]}</span>
          </button>
        ))}
      </div>
      <select className="sel" value={tz} onChange={(e) => onTz(e.target.value as TZ)}>
        <option value="ist">IST 12h</option>
        <option value="ist24">IST 24h</option>
        <option value="local">Local</option>
        <option value="utc">UTC</option>
        <option value="rel">Relative</option>
      </select>
      <select className="sel" value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
        <option value="t">Time ↑</option>
        <option value="-t">Time ↓</option>
        <option value="-lv">Severity</option>
        <option value="-el">Gap size</option>
      </select>
      <details className="export">
        <summary className="btn" style={{ listStyle: "none" }}>
          Export ▾
        </summary>
        <div
          style={{
            position: "absolute",
            right: 14,
            marginTop: 4,
            background: "var(--panel2)",
            border: "1px solid var(--line2)",
            borderRadius: 6,
            padding: 4,
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <button className="btn sm" onClick={onExportEvidence}>
            Evidence bundle (PII redacted)
          </button>
          <button className="btn sm" onClick={onExportShare}>
            Share view (as-is)
          </button>
          <button className="btn sm" onClick={onExportJSON}>
            Events as JSON
          </button>
        </div>
      </details>
    </div>
  );
});
