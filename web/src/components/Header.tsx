interface Props {
  fileCount: number;
  activeCount: number;
  recentCount: number;
  filePanelOpen: boolean;
  onOpenFiles: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  sideOn: boolean;
  onToggleSide: () => void;
  detailOn: boolean;
  onToggleDetail: () => void;
  detailPos: "bottom" | "right";
  onToggleDetailPos: () => void;
}

const SidebarIcon = () => (
  <svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor">
    <rect x="0" y="0" width="4" height="12" rx="1" opacity="0.9" />
    <rect x="5.5" y="0" width="9.5" height="12" rx="1" opacity="0.3" />
  </svg>
);

const PanelBottomIcon = () => (
  <svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor">
    <rect x="0" y="0" width="15" height="7" rx="1" opacity="0.3" />
    <rect x="0" y="8.5" width="15" height="3.5" rx="1" opacity="0.9" />
  </svg>
);

const PanelRightIcon = () => (
  <svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor">
    <rect x="0" y="0" width="9" height="12" rx="1" opacity="0.3" />
    <rect x="10.5" y="0" width="4.5" height="12" rx="1" opacity="0.9" />
  </svg>
);

export function Header({
  fileCount, activeCount, recentCount, filePanelOpen, onOpenFiles,
  theme, onToggleTheme,
  expanded, onToggleExpanded,
  sideOn, onToggleSide,
  detailOn, onToggleDetail, detailPos, onToggleDetailPos,
}: Props) {
  const onBottomClick = () => {
    if (detailOn && detailPos === "bottom") onToggleDetail();
    else {
      if (!detailOn) onToggleDetail();
      if (detailPos !== "bottom") onToggleDetailPos();
    }
  };

  const onRightClick = () => {
    if (detailOn && detailPos === "right") onToggleDetail();
    else {
      if (!detailOn) onToggleDetail();
      if (detailPos !== "right") onToggleDetailPos();
    }
  };

  return (
    <div className={"hd" + (expanded ? " hd-expanded" : "")}>
      <div className="brand">▚ log<em>scope</em></div>

      {/* Files button */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          className={"btn hd-files-btn" + (filePanelOpen ? " on" : "")}
          title="Manage loaded log files"
          onClick={onOpenFiles}
        >
          ◧ Files
          {fileCount > 0 && (
            <span className="hd-files-count">
              {activeCount}/{fileCount}
            </span>
          )}
        </button>
        {recentCount > 0 && <span className="hd-files-dot" />}
      </div>

      <div style={{ flex: 1 }} />

      <div className="hdr-actions">
        <button
          className="btn"
          title={expanded ? "Compact header" : "Spacious header"}
          onClick={onToggleExpanded}
        >
          {expanded ? "Compact" : "Spacious"}
        </button>
        <button className="btn" title="Toggle theme" onClick={onToggleTheme}>
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </div>

      <div className="layout-ctrl">
        <button
          className={"ibtn" + (sideOn ? " on" : "")}
          title={sideOn ? "Hide sidebar" : "Show sidebar"}
          aria-label={sideOn ? "Hide sidebar" : "Show sidebar"}
          aria-pressed={sideOn}
          onClick={onToggleSide}
        >
          <SidebarIcon />
        </button>
        <button
          className={"ibtn" + (detailOn && detailPos === "bottom" ? " on" : "")}
          title="Detail panel — bottom"
          aria-label="Dock detail panel to the bottom"
          aria-pressed={detailOn && detailPos === "bottom"}
          onClick={onBottomClick}
        >
          <PanelBottomIcon />
        </button>
        <button
          className={"ibtn" + (detailOn && detailPos === "right" ? " on" : "")}
          title="Detail panel — right"
          aria-label="Dock detail panel to the right"
          aria-pressed={detailOn && detailPos === "right"}
          onClick={onRightClick}
        >
          <PanelRightIcon />
        </button>
      </div>
    </div>
  );
}
