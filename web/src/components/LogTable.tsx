import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { highlight, type LogEvent } from "@core/index.ts";
import { formatGap, type TimeMode } from "../lib/format.ts";
import type { SortKey } from "../lib/view.ts";
import { TimeText } from "./TimeText.tsx";
import { MergedLegend, type MergedFile } from "./MergedLegend.tsx";

const ROWH = 26;
const EXPANDED_H = 280;

// ─── Column config ────────────────────────────────────────────────────────────

type ColId = "lv" | "ts" | "el" | "rid" | "msg";

interface ColCfg {
  id: ColId;
  label: string;
  width: number;
  flex: boolean;
  visible: boolean;
  sticky: boolean;
}

const DEFAULT_COLS: ColCfg[] = [
  { id: "lv",  label: "Level",     width: 52,  flex: false, visible: true, sticky: false },
  { id: "ts",  label: "Timestamp", width: 186, flex: false, visible: true, sticky: false },
  { id: "el",  label: "+Gap",      width: 64,  flex: false, visible: true, sticky: false },
  { id: "rid", label: "Request",   width: 82,  flex: false, visible: true, sticky: false },
  { id: "msg", label: "Message",   width: 240, flex: true,  visible: true, sticky: false },
];

// ─── Column right-click context menu ─────────────────────────────────────────

interface ColCtx {
  colIdx: number;
  col: ColCfg;
  x: number;
  y: number;
}

function ColContextMenu({
  ctx,
  cols,
  onChange,
  onClose,
}: {
  ctx: ColCtx;
  cols: ColCfg[];
  onChange: (c: ColCfg[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { colIdx, col } = ctx;

  useEffect(() => {
    const md = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const kd = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", md);
      document.addEventListener("keydown", kd);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", md);
      document.removeEventListener("keydown", kd);
    };
  }, [onClose]);

  const update = (patch: Partial<ColCfg>) => {
    onChange(cols.map((c, i) => (i === colIdx ? { ...c, ...patch } : c)));
  };

  const move = (dir: -1 | 1) => {
    const n = [...cols];
    const t = colIdx + dir;
    if (t < 0 || t >= n.length) return;
    [n[colIdx], n[t]] = [n[t]!, n[colIdx]!];
    onChange(n);
    onClose();
  };

  const menuW = 210;
  const menuH = 190;
  const left = Math.min(ctx.x, window.innerWidth - menuW - 8);
  const top = Math.min(ctx.y, window.innerHeight - menuH - 8);

  return (
    <div ref={ref} className="col-ctx-menu" style={{ left, top }}>
      <div className="col-ctx-title">{col.label}</div>
      <div className="col-ctx-sep" />
      <button
        className="col-ctx-item"
        onClick={() => { update({ visible: !col.visible }); onClose(); }}
      >
        <span className="col-ctx-icon">{col.visible ? "○" : "●"}</span>
        {col.visible ? "Hide column" : "Show column"}
      </button>
      {!col.flex && (
        <button
          className="col-ctx-item"
          onClick={() => { update({ sticky: !col.sticky }); onClose(); }}
        >
          <span className="col-ctx-icon">{col.sticky ? "⊢" : "⊣"}</span>
          {col.sticky ? "Unpin from left" : "Pin to left"}
        </button>
      )}
      <div className="col-ctx-sep" />
      <button
        className="col-ctx-item"
        disabled={colIdx === 0}
        onClick={() => move(-1)}
      >
        <span className="col-ctx-icon">←</span>
        Move left
      </button>
      <button
        className="col-ctx-item"
        disabled={colIdx === cols.length - 1}
        onClick={() => move(1)}
      >
        <span className="col-ctx-icon">→</span>
        Move right
      </button>
      <div className="col-ctx-sep" />
      <button className="col-ctx-item col-ctx-dim" onClick={onClose}>
        <span className="col-ctx-icon">✕</span>
        Dismiss
      </button>
    </div>
  );
}

// ─── Column panel (all-column manage) ────────────────────────────────────────

function ColPanel({
  cols,
  onChange,
  onClose,
}: {
  cols: ColCfg[];
  onChange: (c: ColCfg[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const kd = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("keydown", kd);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", kd);
    };
  }, [onClose]);

  const update = (idx: number, patch: Partial<ColCfg>) =>
    onChange(cols.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const move = (idx: number, dir: -1 | 1) => {
    const n = [...cols];
    const t = idx + dir;
    if (t < 0 || t >= n.length) return;
    [n[idx], n[t]] = [n[t]!, n[idx]!];
    onChange(n);
  };

  return (
    <div ref={ref} className="col-panel">
      <div className="col-panel-hd">
        <span>Manage Columns</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn sm" onClick={() => onChange([...DEFAULT_COLS])}>
            Reset
          </button>
          <button className="btn sm" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>
      <div className="col-panel-hint">
        Toggle visibility · Pin to left · Reorder
      </div>
      {cols.map((col, idx) => (
        <div key={col.id} className="col-panel-row">
          <button
            className={"ibtn sm" + (col.visible ? " on" : "")}
            title={col.visible ? "Hide this column" : "Show this column"}
            onClick={() => update(idx, { visible: !col.visible })}
          >
            {col.visible ? "●" : "○"}
          </button>
          <span className={"col-panel-name" + (col.visible ? "" : " col-panel-dim")}>
            {col.label}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
            {!col.flex && (
              <button
                className={"ibtn sm" + (col.sticky ? " on" : "")}
                title={col.sticky ? "Unpin from left" : "Pin to left edge"}
                onClick={() => update(idx, { sticky: !col.sticky })}
              >
                ⊣
              </button>
            )}
            <button
              className="ibtn sm"
              title="Move up in order"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
            >
              ↑
            </button>
            <button
              className="ibtn sm"
              title="Move down in order"
              onClick={() => move(idx, 1)}
              disabled={idx === cols.length - 1}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Row cell content ─────────────────────────────────────────────────────────

function CellContent({
  col,
  e,
  hl,
  tz,
  base,
  isExpanded,
  onToggleExpand,
}: {
  col: ColCfg;
  e: LogEvent;
  hl: (title: string) => string;
  tz: TimeMode;
  base: number;
  isExpanded: boolean;
  onToggleExpand: (id: number, ev: React.MouseEvent) => void;
}) {
  switch (col.id) {
    case "lv":
      return <span className={"lv " + e.level}>{e.level.toUpperCase()}</span>;
    case "ts":
      return (
        <span
          className={"ts" + (isExpanded ? " ts-expanded" : "")}
          title={isExpanded ? "Collapse inline" : "Expand inline"}
          onClick={(ev) => onToggleExpand(e.id, ev)}
        >
          <TimeText t={e.t} tz={tz} base={base} />
          <span className="ts-expand-hint">{isExpanded ? " ▼" : " ▶"}</span>
        </span>
      );
    case "el":
      return <span className="el">{e.el == null ? "" : formatGap(e.el)}</span>;
    case "rid":
      return <span className="rid">{e.rid ? e.rid.slice(0, 10) : ""}</span>;
    case "msg":
      return (
        <>
          {e.frags > 1 && <span className="frag">{e.frags}×</span>}
          <span className="msg" dangerouslySetInnerHTML={{ __html: hl(e.title) }} />
        </>
      );
  }
}

// ─── Memoized virtual row ─────────────────────────────────────────────────────
// A React.memo'd row so unrelated App state changes (selecting a different row,
// opening the detail panel, switching timezone) don't re-render / re-measure
// every visible row. Props are primitives or stable references.

interface RowProps {
  e: LogEvent;
  index: number;
  top: number;
  isExpanded: boolean;
  isSelected: boolean;
  isNew: boolean;
  wrap: boolean;
  showColors: boolean;
  fileColor: string;
  hl: (title: string) => string;
  tz: TimeMode;
  base: number;
  stickyCols: ColCfg[];
  scrollCols: ColCfg[];
  stickyGrpStyle: React.CSSProperties;
  scrollGrpStyle: React.CSSProperties;
  cellStyle: (col: ColCfg) => React.CSSProperties;
  measureRef: ((el: HTMLElement | null) => void) | undefined;
  onSelect: (e: LogEvent) => void;
  onToggleExpand: (id: number, ev: React.MouseEvent) => void;
}

const Row = memo(function Row({
  e, index, top, isExpanded, isSelected, isNew, wrap, showColors, fileColor,
  hl, tz, base, stickyCols, scrollCols, stickyGrpStyle, scrollGrpStyle, cellStyle,
  measureRef, onSelect, onToggleExpand,
}: RowProps) {
  const isError = e.level === "error";
  return (
    <div
      data-index={index}
      ref={measureRef}
      className={
        "row" +
        (wrap && !isExpanded ? " row-wrap" : "") +
        (isExpanded ? " row-expanded" : "") +
        (isSelected ? " sel" : "") +
        (isError ? " err" : "") +
        (isNew ? " row-new" : "") +
        (showColors ? " row-colored" : "")
      }
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transform: `translateY(${top}px)`,
        minWidth: "100%",
        padding: 0,
        height: isExpanded ? EXPANDED_H : wrap ? "auto" : undefined,
        ...(isExpanded ? { flexDirection: "column", alignItems: "stretch" } : {}),
        ...(showColors ? { "--rc": fileColor } as React.CSSProperties : {}),
      }}
      onClick={() => onSelect(e)}
    >
      <div
        style={
          isExpanded
            ? { display: "flex", height: ROWH, flexShrink: 0, alignItems: "center" }
            : { display: "contents" }
        }
      >
        {(stickyCols.length > 0 || showColors) && (
          <div
            className="sticky-grp"
            style={{
              ...stickyGrpStyle,
              ...(showColors ? { boxShadow: `inset 3px 0 0 ${fileColor}` } : {}),
              ...(showColors && stickyCols.length === 0
                ? { padding: 0, width: 3, paddingLeft: 0, paddingRight: 0 }
                : {}),
            }}
          >
            {stickyCols.map((col) => (
              <div key={col.id} style={cellStyle(col)}>
                <CellContent col={col} e={e} hl={hl} tz={tz} base={base} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
              </div>
            ))}
          </div>
        )}
        <div style={scrollGrpStyle}>
          {scrollCols.map((col) => (
            <div key={col.id} style={cellStyle(col)}>
              <CellContent col={col} e={e} hl={hl} tz={tz} base={base} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
            </div>
          ))}
        </div>
      </div>

      {isExpanded && (
        <div className="row-body" onClick={(ev) => ev.stopPropagation()}>
          <pre className="row-json">
            {e.parsed ? JSON.stringify(e.payload, null, 2) : e.text}
          </pre>
        </div>
      )}
    </div>
  );
});

// ─── Column header cell ───────────────────────────────────────────────────────

function ColHdCell({
  col,
  sort,
  onSortColumn,
  onContextMenu,
}: {
  col: ColCfg;
  sort: SortKey;
  onSortColumn: (key: "lv" | "t" | "el") => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const sortKey = col.id === "lv" ? "lv" : col.id === "ts" ? "t" : col.id === "el" ? "el" : null;
  const isActive = sortKey ? sort === sortKey || sort === `-${sortKey}` : false;
  const indicator = sortKey
    ? sort === sortKey ? " ↑" : sort === `-${sortKey}` ? " ↓" : ""
    : "";

  const style: React.CSSProperties = {
    width: col.flex ? undefined : col.width,
    flex: col.flex ? 1 : undefined,
    flexShrink: col.flex ? 1 : 0,
    minWidth: col.flex ? col.width : undefined,
    cursor: sortKey ? "pointer" : "default",
    color: isActive ? "var(--cyan)" : undefined,
    userSelect: "none",
  };

  return (
    <span
      style={style}
      onClick={sortKey ? () => onSortColumn(sortKey) : undefined}
      onContextMenu={onContextMenu}
      title="Right-click for column options"
    >
      {col.label}{indicator}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  view: LogEvent[];
  selId: number;
  tz: TimeMode;
  base: number;
  q: string;
  sort: SortKey;
  scrollRef: RefObject<HTMLDivElement>;
  recentFiles?: Set<string>;
  fileColors?: Record<string, string>;
  showColors?: boolean;
  mergedFiles?: MergedFile[];
  onIsolateFile?: (name: string) => void;
  onSelect: (e: LogEvent) => void;
  onSortColumn: (key: "lv" | "t" | "el") => void;
}

const GRP_PAD_L = 12;
const GRP_GAP = 9;

function LogTableInner({ view, selId, tz, base, q, sort, scrollRef, recentFiles, fileColors, showColors, mergedFiles, onIsolateFile, onSelect, onSortColumn }: Props) {
  const [cols, setCols] = useState<ColCfg[]>([...DEFAULT_COLS]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ColCtx | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [wrap, setWrap] = useState(true);

  const toggleExpand = useCallback((id: number, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setExpandedRows((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  // W4: build the highlighter (and its regex) ONCE per query, with a per-query
  // cache keyed by title, instead of rebuilding the regex inside every row.
  const hl = useMemo(() => {
    const cache = new Map<string, string>();
    return (title: string): string => {
      let v = cache.get(title);
      if (v === undefined) {
        v = highlight(title, q);
        cache.set(title, v);
      }
      return v;
    };
  }, [q]);

  // Per-file event counts within the current view, for the floating legend.
  // Only computed in merged colour mode so it never costs anything otherwise.
  const fileCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (!showColors) return m;
    for (const e of view) m.set(e.file, (m.get(e.file) ?? 0) + 1);
    return m;
  }, [view, showColors]);

  // Stable onSelect wrapper so the memoized Row isn't invalidated when the
  // parent's onSelect identity changes on selection.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const handleSelect = useCallback((e: LogEvent) => onSelectRef.current(e), []);

  const visibleCols = useMemo(() => cols.filter((c) => c.visible), [cols]);
  const stickyCols = useMemo(() => visibleCols.filter((c) => c.sticky), [visibleCols]);
  const scrollCols = useMemo(() => visibleCols.filter((c) => !c.sticky), [visibleCols]);

  const estimateSize = useCallback(
    (i: number) => {
      const e = view[i];
      return e && expandedRows.has(e.id) ? EXPANDED_H : ROWH;
    },
    [view, expandedRows],
  );

  const virt = useVirtualizer({
    count: view.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    // measureElement lets the virtualizer learn actual heights after render,
    // which is required for wrap mode where rows have height:auto.
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 12,
  });

  // Re-estimate all rows when expandedRows or wrap mode changes
  useEffect(() => { virt.measure(); }, [expandedRows]);
  useEffect(() => { virt.measure(); }, [wrap]);

  const minTableW =
    GRP_PAD_L +
    stickyCols.reduce((s, c) => s + c.width + GRP_GAP, 0) +
    scrollCols.reduce((s, c) => s + c.width + GRP_GAP, 0) +
    GRP_PAD_L;

  // cellStyle depends only on wrap; stable identity keeps memoized rows stable.
  const cellStyle = useCallback(
    (col: ColCfg): React.CSSProperties => ({
      width: col.flex ? undefined : col.width,
      flex: col.flex ? 1 : undefined,
      flexShrink: col.flex ? 1 : 0,
      minWidth: col.flex ? col.width : undefined,
      // allow the msg cell to grow vertically when wrapping; clip others
      overflow: wrap && col.id === "msg" ? "visible" : "hidden",
    }),
    [wrap],
  );

  const GRP_BASE: React.CSSProperties = useMemo(
    () => ({ display: "flex", alignItems: wrap ? "flex-start" : "center", gap: GRP_GAP, flexShrink: 0 }),
    [wrap],
  );

  // NOTE: background NOT set here — driven by .sticky-grp CSS + row state selectors
  const stickyGrpStyle: React.CSSProperties = useMemo(
    () => ({
      ...GRP_BASE,
      position: "sticky",
      left: 0,
      paddingLeft: GRP_PAD_L,
      paddingRight: GRP_GAP,
      paddingTop: wrap ? 4 : 0,
      paddingBottom: wrap ? 4 : 0,
      zIndex: 1,
      borderRight: stickyCols.length && scrollCols.length ? "1px solid var(--line2)" : undefined,
    }),
    [GRP_BASE, wrap, stickyCols.length, scrollCols.length],
  );

  const scrollGrpStyle: React.CSSProperties = useMemo(
    () => ({
      ...GRP_BASE,
      flex: 1,
      paddingLeft: stickyCols.length ? 0 : GRP_PAD_L,
      paddingRight: GRP_PAD_L,
      paddingTop: wrap ? 4 : 0,
      paddingBottom: wrap ? 4 : 0,
      minWidth: 0,
    }),
    [GRP_BASE, wrap, stickyCols.length],
  );

  const openCtx = (col: ColCfg, e: React.MouseEvent) => {
    e.preventDefault();
    const colIdx = cols.indexOf(col);
    setCtxMenu({ colIdx, col, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="log-table-wrap">
    <div className="scroll" ref={scrollRef}>
      {view.length === 0 ? (
        <div className="empty">No events match these filters</div>
      ) : (
        <div style={{ minWidth: Math.max(minTableW, 480) }}>
          {/* Column header */}
          <div
            className="colhd"
            style={{ position: "sticky", top: 0, zIndex: 2, padding: 0, display: "flex" }}
          >
            {stickyCols.length > 0 && (
              <div
                style={{
                  ...GRP_BASE,
                  position: "sticky",
                  left: 0,
                  paddingLeft: GRP_PAD_L,
                  paddingRight: GRP_GAP,
                  zIndex: 3,
                  background: "var(--panel2)",
                  borderRight: scrollCols.length > 0 ? "1px solid var(--line2)" : undefined,
                }}
              >
                {stickyCols.map((col) => (
                  <ColHdCell
                    key={col.id}
                    col={col}
                    sort={sort}
                    onSortColumn={onSortColumn}
                    onContextMenu={(e) => openCtx(col, e)}
                  />
                ))}
              </div>
            )}
            <div
              style={{
                ...GRP_BASE,
                flex: 1,
                paddingLeft: stickyCols.length ? 0 : GRP_PAD_L,
                paddingRight: GRP_PAD_L,
                minWidth: 0,
              }}
            >
              {scrollCols.map((col) => (
                <ColHdCell
                  key={col.id}
                  col={col}
                  sort={sort}
                  onSortColumn={onSortColumn}
                  onContextMenu={(e) => openCtx(col, e)}
                />
              ))}
            </div>

            {/* Table controls — Wrap + Columns */}
            <div style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 4, paddingLeft: 6, paddingRight: 8, borderLeft: "1px solid var(--line)" }}>
              <button
                className={"btn sm" + (wrap ? " on" : "")}
                title={wrap ? "Disable text wrapping — single line per row" : "Wrap long messages across multiple lines"}
                onClick={() => setWrap((w) => !w)}
              >
                ⏎ Wrap
              </button>
              <button
                className={"btn sm col-mgr-btn" + (panelOpen ? " on" : "")}
                title="Manage column visibility, order and pinning"
                onClick={() => setPanelOpen((o) => !o)}
              >
                ▤ Columns
              </button>
              {panelOpen && (
                <ColPanel
                  cols={cols}
                  onChange={setCols}
                  onClose={() => setPanelOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Virtual rows */}
          <div style={{ height: virt.getTotalSize(), position: "relative" }}>
            {virt.getVirtualItems().map((item) => {
              const e = view[item.index]!;
              const isExpanded = expandedRows.has(e.id);
              // W2 fast path: only dynamic-height rows (wrapped, not expanded)
              // need measurement; fixed ROWH / EXPANDED_H rows skip it entirely.
              const needsMeasure = wrap && !isExpanded;
              return (
                <Row
                  key={e.id}
                  e={e}
                  index={item.index}
                  top={item.start}
                  isExpanded={isExpanded}
                  isSelected={e.id === selId}
                  isNew={recentFiles?.has(e.file ?? "") ?? false}
                  wrap={wrap}
                  showColors={!!showColors}
                  fileColor={showColors ? (fileColors?.[e.file] ?? "transparent") : "transparent"}
                  hl={hl}
                  tz={tz}
                  base={base}
                  stickyCols={stickyCols}
                  scrollCols={scrollCols}
                  stickyGrpStyle={stickyGrpStyle}
                  scrollGrpStyle={scrollGrpStyle}
                  cellStyle={cellStyle}
                  measureRef={needsMeasure ? virt.measureElement : undefined}
                  onSelect={handleSelect}
                  onToggleExpand={toggleExpand}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Right-click context menu — position:fixed so it's never clipped */}
      {ctxMenu && (
        <ColContextMenu
          ctx={ctxMenu}
          cols={cols}
          onChange={setCols}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
    {showColors && mergedFiles && mergedFiles.length > 1 && (
      <MergedLegend
        files={mergedFiles}
        counts={fileCounts}
        onIsolate={(name) => onIsolateFile?.(name)}
      />
    )}
    </div>
  );
}

// W3: memoized so typing in the search box (App re-renders on every keystroke,
// but `q`/`view` only change on the debounced commit) doesn't re-render the table.
export const LogTable = memo(LogTableInner);
