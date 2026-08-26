import { useEffect, useRef, useState } from "react";
import type { LogFile } from "@core/index.ts";

export const FILE_COLORS = [
  "#22d3ee", "#a78bfa", "#34d399", "#fb923c",
  "#f472b6", "#facc15", "#60a5fa", "#f87171",
];

export function getFileColor(index: number): string {
  return FILE_COLORS[index % FILE_COLORS.length]!;
}

// ─── Tab right-click context menu ─────────────────────────────────────────────

interface TabCtx {
  name: string;
  label: string;
  inMerge: boolean;
  x: number;
  y: number;
}

function TabContextMenu({
  ctx,
  onIsolate,
  onToggleMerge,
  onDismissTab,
  onRemoveFile,
  onDismiss,
}: {
  ctx: TabCtx;
  onIsolate: () => void;
  onToggleMerge: () => void;
  onDismissTab: () => void;
  onRemoveFile: () => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    const md = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const kd = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", md);
      document.addEventListener("keydown", kd);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", md);
      document.removeEventListener("keydown", kd);
    };
  }, [onDismiss]);

  const menuW = 200, menuH = 160;
  const left = Math.min(ctx.x, window.innerWidth - menuW - 8);
  const top = Math.min(ctx.y, window.innerHeight - menuH - 8);

  return (
    <div ref={ref} className="tab-ctx-menu" style={{ left, top }}>
      <div className="tab-ctx-title">{ctx.label}</div>
      {!confirmRemove ? (
        <>
          <button className="tab-ctx-item" onClick={() => { onIsolate(); onDismiss(); }}>
            <span className="tab-ctx-icon">◎</span>
            Isolate this file
          </button>
          <button className="tab-ctx-item" onClick={() => { onToggleMerge(); onDismiss(); }}>
            <span className="tab-ctx-icon">{ctx.inMerge ? "✓" : "⊕"}</span>
            {ctx.inMerge ? "Remove from merged view" : "Add to merged view"}
          </button>
          <div className="tab-ctx-sep" />
          <button className="tab-ctx-item" onClick={() => { onDismissTab(); onDismiss(); }}>
            <span className="tab-ctx-icon">✕</span>
            Close tab
          </button>
          <button className="tab-ctx-item danger" onClick={() => setConfirmRemove(true)}>
            <span className="tab-ctx-icon">🗑</span>
            Remove from session…
          </button>
        </>
      ) : (
        <>
          <div style={{ padding: "8px 12px 6px", fontSize: 11.5, color: "var(--fg)" }}>
            Remove <b>{ctx.label}</b> from session?
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            <button
              className="btn sm"
              style={{ color: "var(--rose)", borderColor: "var(--rose)", flex: 1 }}
              onClick={() => { onRemoveFile(); onDismiss(); }}
            >
              Remove
            </button>
            <button className="btn sm" style={{ flex: 1 }} onClick={() => setConfirmRemove(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FileTabsProps {
  files: LogFile[];
  fileLabels: Record<string, string>;
  fileColors: Record<string, string>;
  tabOrder: string[];
  activeTab: string | "merged";
  mergedSet: Set<string>;
  recentFiles: Set<string>;
  closedTabs: Set<string>;
  onTabClick: (tab: string | "merged") => void;
  onAddToMerge: (name: string) => void;
  onRemoveFromMerge: (name: string) => void;
  onMergeAll: () => void;
  onUnmergeAll: () => void;
  onDismissTab: (name: string) => void;
  onRemoveFile: (name: string) => void;
  onReorder: (order: string[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileTabs({
  files, fileLabels, fileColors, tabOrder,
  activeTab, mergedSet, recentFiles, closedTabs,
  onTabClick, onAddToMerge, onRemoveFromMerge,
  onMergeAll, onUnmergeAll, onDismissTab, onRemoveFile, onReorder,
}: FileTabsProps) {
  const [ctxMenu, setCtxMenu] = useState<TabCtx | null>(null);
  const [dragName, setDragName] = useState<string | null>(null);
  const [dropName, setDropName] = useState<string | null>(null);

  if (files.length === 0) return null;
  const multi = files.length > 1;
  const mergedCount = mergedSet.size;

  // Render tabs in user-specified order, excluding closed tabs
  const fileMap = new Map(files.map((f) => [f.name, f]));
  const orderedNames = [
    ...tabOrder.filter((n) => fileMap.has(n) && !closedTabs.has(n)),
    ...files.map((f) => f.name).filter((n) => !tabOrder.includes(n) && !closedTabs.has(n)),
  ];

  const handleDragStart = (name: string) => setDragName(name);

  const handleDrop = (targetName: string) => {
    if (!dragName || dragName === targetName) return;
    const order = [...orderedNames];
    const from = order.indexOf(dragName);
    const to = order.indexOf(targetName);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragName);
    onReorder(order);
    setDragName(null);
    setDropName(null);
  };

  const handleDragEnd = () => { setDragName(null); setDropName(null); };

  return (
    <>
      <div className="ftabs">
        {/* Merged tab */}
        {multi && (
          <>
            <button
              className={"ftab-merged" + (activeTab === "merged" ? " on" : "")}
              onClick={() => onTabClick("merged")}
              title="Merged view — all selected files sorted by timestamp"
            >
              <span className="ftab-icon">⊞</span>
              <span>Merged</span>
              <span className="ftab-badge">{mergedCount}</span>
            </button>
            <div className="ftabs-sep" />
          </>
        )}

        {/* File tabs */}
        <div className="ftabs-list">
          {orderedNames.map((name, i) => {
            const f = fileMap.get(name);
            if (!f) return null;
            const label = fileLabels[name] ?? name;
            const color = fileColors[name] ?? getFileColor(i);
            const inMerge = mergedSet.has(name);
            const isActive = activeTab === name;
            const isNew = recentFiles.has(name);
            const isDragging = dragName === name;
            const isDropTarget = dropName === name && dragName !== name;

            return (
              <div
                key={name}
                className={
                  "ftab" +
                  (isActive ? " on" : "") +
                  (isNew ? " ftab-new" : "") +
                  (isDragging ? " dragging" : "") +
                  (isDropTarget ? " drag-over" : "")
                }
                style={{ "--fc": color } as React.CSSProperties}
                draggable
                onDragStart={() => handleDragStart(name)}
                onDragOver={(e) => { e.preventDefault(); setDropName(name); }}
                onDragLeave={() => setDropName(null)}
                onDrop={(e) => { e.preventDefault(); handleDrop(name); }}
                onDragEnd={handleDragEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ name, label, inMerge, x: e.clientX, y: e.clientY });
                }}
              >
                <button
                  className="ftab-body"
                  onClick={() => onTabClick(name)}
                  title={name !== label ? `${label}\n(${name})` : name}
                >
                  <span className="ftab-dot" style={{ background: color }} />
                  <span className="ftab-lbl">{label}</span>
                  <span className="ftab-cnt">{(f.count ?? 0).toLocaleString()}</span>
                </button>
                <button
                  className="ftab-close"
                  title="Close tab (file stays in Files panel)"
                  onClick={(e) => { e.stopPropagation(); onDismissTab(name); }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Bulk actions */}
        {multi && (
          <div className="ftabs-bulk">
            <button className="btn sm" onClick={onMergeAll} title="Add all files to merged view">
              Merge all
            </button>
            <button className="btn sm" onClick={onUnmergeAll} title="Isolate first file">
              Unmerge all
            </button>
          </div>
        )}
      </div>

      {/* Right-click context menu — position:fixed, never clipped */}
      {ctxMenu && (
        <TabContextMenu
          ctx={ctxMenu}
          onIsolate={() => onTabClick(ctxMenu.name)}
          onToggleMerge={() =>
            ctxMenu.inMerge
              ? onRemoveFromMerge(ctxMenu.name)
              : onAddToMerge(ctxMenu.name)
          }
          onDismissTab={() => onDismissTab(ctxMenu.name)}
          onRemoveFile={() => onRemoveFile(ctxMenu.name)}
          onDismiss={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}
