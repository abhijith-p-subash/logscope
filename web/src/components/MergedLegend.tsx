import { memo, useState } from "react";

export interface MergedFile {
  name: string;
  label: string;
  color: string;
}

interface Props {
  files: MergedFile[];
  /** Event count per file within the current (filtered) view. */
  counts: Map<string, number>;
  /** Click a file to isolate it as its own tab. */
  onIsolate: (name: string) => void;
}

/**
 * Floating colour legend for the merged view. Maps each file's accent colour to
 * its name so a reader can tell interleaved sources apart without opening the
 * Files panel. Deliberately unobtrusive: it sits in the bottom-right corner of
 * the table, is translucent until hovered, and can be collapsed to a pill or
 * hidden entirely so it never covers the log content being analysed.
 */
export const MergedLegend = memo(function MergedLegend({ files, counts, onIsolate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (files.length === 0) return null;

  // Fully hidden → tiny restore pill in the corner.
  if (hidden) {
    return (
      <button
        className="mlgd-restore"
        title="Show file legend"
        aria-label="Show file legend"
        onClick={() => setHidden(false)}
      >
        ⊞ {files.length}
      </button>
    );
  }

  return (
    <div className={"mlgd" + (collapsed ? " mlgd-collapsed" : "")} role="group" aria-label="Merged file legend">
      <div className="mlgd-hd">
        <span className="mlgd-title">⊞ {files.length} files</span>
        <div className="mlgd-hd-acts">
          <button
            className="mlgd-ibtn"
            title={collapsed ? "Expand legend" : "Collapse legend"}
            aria-label={collapsed ? "Expand legend" : "Collapse legend"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "▸" : "▾"}
          </button>
          <button
            className="mlgd-ibtn"
            title="Hide legend"
            aria-label="Hide legend"
            onClick={() => setHidden(true)}
          >
            ✕
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mlgd-list">
          {files.map((f) => (
            <button
              key={f.name}
              className="mlgd-row"
              title={`${f.label}\nClick to isolate this file in its own tab`}
              onClick={() => onIsolate(f.name)}
            >
              <span className="mlgd-swatch" style={{ background: f.color }} />
              <span className="mlgd-name">{f.label}</span>
              <span className="mlgd-count">{(counts.get(f.name) ?? 0).toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
