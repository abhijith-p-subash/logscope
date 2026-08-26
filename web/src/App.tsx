import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Level, LogEvent } from "@core/index.ts";
import { uploadFile, deleteFile } from "./lib/api.ts";
import { exportEvidence, exportShare, exportViewJSON } from "./lib/export.ts";
import { computeView, emptyFilters, type Filters, type SortKey, type TZ } from "./lib/view.ts";
import { useResize } from "./lib/useResize.ts";
import { useSession } from "./state/useSession.ts";
import { useToast } from "./state/useToast.ts";
import { BrandMark } from "./components/BrandMark.tsx";
import { Header } from "./components/Header.tsx";
import { FileTabs, getFileColor } from "./components/FileTabs.tsx";
import { FilePanel } from "./components/FilePanel.tsx";
import { Ribbon } from "./components/Ribbon.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { FilterChips } from "./components/FilterChips.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { LogTable } from "./components/LogTable.tsx";
import { DetailPanel } from "./components/DetailPanel.tsx";
import { StatusBar } from "./components/StatusBar.tsx";
import { ToastStack } from "./components/ToastStack.tsx";
import { Shortcuts } from "./components/Shortcuts.tsx";
import { ViewTabs, type ViewMode } from "./components/ViewTabs.tsx";
import { Waterfall } from "./components/analysis/Waterfall.tsx";
import { AgentTreeView } from "./components/analysis/AgentTreeView.tsx";
import { RunDiff } from "./components/analysis/RunDiff.tsx";
import { GoldenPathView } from "./components/analysis/GoldenPathView.tsx";
import { ConcurrencyLens } from "./components/analysis/ConcurrencyLens.tsx";

const ROWH = 26;
const SUPPORTED = /\.(json|ndjson|csv|txt|log)$/i;

async function uploadFiles(list: FileList | File[], toast: (m: string) => void): Promise<void> {
  const arr = [...list].filter((f) => SUPPORTED.test(f.name));
  if (!arr.length) {
    toast("No supported files — need .json, .ndjson, .csv or .log");
    return;
  }
  let n = 0;
  for (const f of arr) {
    try {
      await uploadFile(f.name, await f.text());
      n++;
    } catch {
      toast("Could not upload " + f.name);
    }
  }
  if (n) toast(`Uploaded ${n} file${n > 1 ? "s" : ""}`);
}

export default function App() {
  const { session, connected, error } = useSession();
  const { toasts, toast, dismiss } = useToast();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [tz, setTz] = useState<TZ>("ist");
  const [sort, setSort] = useState<SortKey>("t");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [qInput, setQInput] = useState("");
  const [selId, setSelId] = useState(-1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPos, setDetailPos] = useState<"bottom" | "right">("bottom");
  const [sideOn, setSideOn] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<ViewMode>("log");

  // File panel state
  const [filePanelOpen, setFilePanelOpen] = useState(false);
  // Display-name overrides (original filename → user label, client-side only)
  const [fileLabels, setFileLabels] = useState<Record<string, string>>({});
  // Files the user removed from the session view (client-side hide)
  const [removedFiles, setRemovedFiles] = useState<Set<string>>(new Set());
  // Recently added files (for NEW badge + row flash animation)
  const [recentFiles, setRecentFiles] = useState<Set<string>>(new Set());
  const prevFileNamesRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // File tabs state
  const [activeTab, setActiveTab] = useState<string | "merged">("merged");
  const [mergedSet, setMergedSet] = useState<Set<string>>(new Set());
  const [fileColors, setFileColors] = useState<Record<string, string>>({});
  const colorIdxRef = useRef(0);
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  // Tabs dismissed by the user (file still loaded, just not shown as a tab)
  const [closedTabs, setClosedTabs] = useState<Set<string>>(new Set());

  // Resizable panels
  const [sideWidth, onSideResize] = useResize(224, 120, 520);
  const [detailHeight, onDetailHeightResize] = useResize(260, 100, 700);
  const [detailWidth, onDetailWidthResize] = useResize(380, 180, 720);

  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Slightly higher debounce: on a large corpus each committed query triggers
    // computeView + sidebar recompute + ribbon accent redraw, so we coalesce
    // fast typing into fewer commits without feeling laggy.
    const id = setTimeout(() => setFilters((f) => ({ ...f, q: qInput })), 180);
    return () => clearTimeout(id);
  }, [qInput]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Track newly added files and animate them
  useEffect(() => {
    const currentNames = new Set(session?.files.map((f) => f.name) ?? []);
    if (!initializedRef.current) {
      // First load: snapshot but don't animate
      prevFileNamesRef.current = currentNames;
      initializedRef.current = true;
      return;
    }
    const newOnes = [...currentNames].filter((n) => !prevFileNamesRef.current.has(n));
    if (newOnes.length > 0) {
      setRecentFiles((s) => new Set([...s, ...newOnes]));
      // Clear "recent" badge after 4 s so animation stops
      setTimeout(() => {
        setRecentFiles((s) => {
          const n = new Set(s);
          newOnes.forEach((name) => n.delete(name));
          return n;
        });
      }, 4000);
    }
    prevFileNamesRef.current = currentNames;
  }, [session?.files]);

  const events = session?.events ?? [];

  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const view = useMemo(() => computeView(events, filters, sort), [events, filters, sort]);
  const inView = useMemo(() => new Set(view.map((e) => e.id)), [view]);

  const t0 = events.length ? events[0]!.t : 0;
  const t1 = events.length ? events[events.length - 1]!.t : 0;

  const levelCounts = useMemo(() => {
    const c: Record<Level, number> = { error: 0, warn: 0, info: 0, debug: 0 };
    for (const e of events) c[e.level]++;
    return c;
  }, [events]);

  const rids = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of view) if (e.rid) m.set(e.rid, (m.get(e.rid) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300);
  }, [view]);

  const sigs = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of view) if (e.sig) m.set(e.sig, (m.get(e.sig) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80);
  }, [view]);

  const rejoined = useMemo(() => {
    const frag = events.filter((e) => e.frags > 1);
    return { rows: frag.reduce((a, e) => a + e.frags, 0), events: frag.length };
  }, [events]);

  const errorsInView = useMemo(() => view.reduce((n, e) => n + (e.level === "error" ? 1 : 0), 0), [view]);
  const warnings = useMemo(
    () => Object.values(session?.diagnostics ?? {}).flatMap((d) => d.warnings),
    [session],
  );

  const selected = selId >= 0 ? (eventById.get(selId) ?? null) : null;

  const traces = session?.traces ?? [];
  const activeTrace = useMemo(() => {
    const rid = filters.rid ?? selected?.rid ?? null;
    return rid ? (traces.find((t) => t.rid === rid) ?? null) : null;
  }, [traces, filters.rid, selected]);

  const sources = (session?.files ?? [])
    .filter((f) => !filters.offFiles.has(f.name))
    .map((f) => f.name);
  const filterDesc = [
    filters.q,
    filters.rid ? `request ${filters.rid}` : "",
    filters.levels.size ? [...filters.levels].join("/") : "",
    filters.range ? "time range" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const select = useCallback(
    (e: LogEvent) => {
      if (e.id === selId && detailOpen) {
        setDetailOpen(false);
        setSelId(-1);
      } else {
        setSelId(e.id);
        setDetailOpen(true);
      }
    },
    [selId, detailOpen],
  );

  const copy = useCallback(
    (text: string, label: string) => {
      navigator.clipboard.writeText(text).then(
        () => toast(`Copied ${label}`, "success"),
        () => toast("Clipboard blocked by browser", "error"),
      );
    },
    [toast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if ((e.key === "?" || (e.key === "/" && e.shiftKey)) && !typing) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (typing) (e.target as HTMLElement).blur();
        else if (showShortcuts) setShowShortcuts(false);
        else {
          setDetailOpen(false);
          setSelId(-1);
        }
        return;
      }
      if (typing || !view.length) return;

      const pos = view.findIndex((x) => x.id === selId);
      const move = (dir: number) => {
        const np = pos < 0 ? 0 : Math.max(0, Math.min(view.length - 1, pos + dir));
        select(view[np]!);
        const sc = scrollRef.current;
        if (sc) {
          const y = np * ROWH;
          if (y < sc.scrollTop) sc.scrollTop = y;
          else if (y + ROWH > sc.scrollTop + sc.clientHeight - 1)
            sc.scrollTop = y + ROWH - sc.clientHeight + 1;
        }
      };

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "e") {
        e.preventDefault();
        if (selId >= 0) setDetailOpen(true);
      } else if (e.key === "g") {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      } else if (e.key === "G") {
        if (scrollRef.current) scrollRef.current.scrollTop = view.length * ROWH;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, selId, select, showShortcuts]);

  const onSortColumn = useCallback((key: "lv" | "t" | "el") => {
    setSort((cur) => {
      if (key === "t") return cur === "t" ? "-t" : "t";
      if (key === "lv") return "-lv";
      return "-el";
    });
  }, []);

  // Stable callbacks so memoized children (Ribbon, Toolbar) aren't invalidated.
  const onBrush = useCallback((range: [number, number] | null) => {
    setFilters((f) => ({ ...f, range }));
  }, []);

  const toggleLevel = useCallback((l: Level) => {
    setFilters((f) => {
      const levels = new Set(f.levels);
      if (levels.has(l)) levels.delete(l);
      else levels.add(l);
      return { ...f, levels };
    });
  }, []);

  const clearLevel = useCallback((l: Level) => {
    setFilters((f) => {
      const levels = new Set(f.levels);
      levels.delete(l);
      return { ...f, levels };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setQInput("");
    setFilters((f) => ({ ...f, q: "", levels: new Set(), rid: null, sig: null, range: null }));
  }, []);

  const renameFile = useCallback((name: string, label: string) => {
    setFileLabels((prev) => ({ ...prev, [name]: label }));
  }, []);

  const removeFile = useCallback((name: string) => {
    // Remove from server (primary fix — prevents reappearing on reload)
    void deleteFile(name).catch(() => {/* server-side remove best-effort */});
    // Client-side safeguard
    setRemovedFiles((s) => new Set([...s, name]));
    setFilters((f) => {
      const offFiles = new Set(f.offFiles);
      offFiles.add(name);
      return { ...f, offFiles };
    });
  }, []);

  // Files visible in the UI (excludes client-side removed ones)
  const files = (session?.files ?? []).filter((f) => !removedFiles.has(f.name));

  // Dismiss a tab: hides it from the tab bar but keeps the file in the Files panel.
  // If it was active, move to the next open tab (or merged as a last resort).
  const dismissTab = useCallback(
    (name: string) => {
      setClosedTabs((s) => new Set([...s, name]));
      if (activeTab === name) {
        const nextOpen = files.find((f) => f.name !== name && !closedTabs.has(f.name));
        setActiveTab(nextOpen ? nextOpen.name : "merged");
      }
    },
    [activeTab, files, closedTabs],
  );

  // Open (or re-open) a file as a tab — used by double-click in the Files panel.
  const openTab = useCallback((name: string) => {
    setClosedTabs((s) => { if (!s.has(name)) return s; const n = new Set(s); n.delete(name); return n; });
    setActiveTab(name);
    setFilePanelOpen(false);
  }, []);

  // Auto-assign a stable colour to each file. Merging is NOT automatic —
  // files stay in their own tabs until the user explicitly merges them.
  useEffect(() => {
    if (files.length === 0) return;
    setFileColors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const f of files) {
        if (!(f.name in next)) {
          next[f.name] = getFileColor(colorIdxRef.current++);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => f.name).join(",")]);

  // Default the active tab to the first file the first time any load.
  const tabInitRef = useRef(false);
  useEffect(() => {
    if (!tabInitRef.current && files.length > 0) {
      tabInitRef.current = true;
      setActiveTab(files[0]!.name);
    }
  }, [files]);

  // If the active file tab disappears (removed), fall back to another open tab.
  useEffect(() => {
    if (activeTab !== "merged" && !files.find((f) => f.name === activeTab)) {
      const nextOpen = files.find((f) => !closedTabs.has(f.name));
      setActiveTab(nextOpen ? nextOpen.name : "merged");
    }
  }, [files, activeTab, closedTabs]);

  // Single source of truth for visibility: derive offFiles from the active tab
  // and the merged set. Every tab/merge handler just updates those two states.
  useEffect(() => {
    setFilters((f) => {
      const off =
        activeTab === "merged"
          ? new Set(files.filter((fi) => !mergedSet.has(fi.name)).map((fi) => fi.name))
          : new Set(files.filter((fi) => fi.name !== activeTab).map((fi) => fi.name));
      if (off.size === f.offFiles.size && [...off].every((n) => f.offFiles.has(n))) return f;
      return { ...f, offFiles: off };
    });
  }, [activeTab, mergedSet, files]);

  // Keep tab order in sync: preserve user-drag order, append new files, drop removed ones
  useEffect(() => {
    setTabOrder((prev) => {
      const names = files.map((f) => f.name);
      const kept = prev.filter((n) => names.includes(n));
      const added = names.filter((n) => !prev.includes(n));
      const next = [...kept, ...added];
      // avoid re-render when nothing changed
      if (next.length === prev.length && next.every((n, i) => n === prev[i])) return prev;
      return next;
    });
  }, [files]);

  const showColors = activeTab === "merged" && mergedSet.size > 1;

  // Files in the merged view, in tab order, for the floating colour legend.
  const mergedFiles = useMemo(() => {
    if (!showColors) return [];
    const order = tabOrder.length ? tabOrder : files.map((f) => f.name);
    return order
      .filter((n) => mergedSet.has(n))
      .map((n, i) => ({
        name: n,
        label: fileLabels[n] ?? n,
        color: fileColors[n] ?? getFileColor(i),
      }));
  }, [showColors, tabOrder, files, mergedSet, fileLabels, fileColors]);

  // Tab/merge handlers only update activeTab + mergedSet; the effect above
  // derives offFiles. Opening a tab also un-closes it if it was dismissed.
  const handleTabClick = useCallback((tab: string | "merged") => {
    if (tab !== "merged") setClosedTabs((s) => { if (!s.has(tab)) return s; const n = new Set(s); n.delete(tab); return n; });
    setActiveTab(tab);
  }, []);

  const handleAddToMerge = useCallback((name: string) => {
    setMergedSet((s) => new Set([...s, name]));
    setActiveTab("merged");
  }, []);

  const handleRemoveFromMerge = useCallback((name: string) => {
    setMergedSet((s) => new Set([...s].filter((n) => n !== name)));
  }, []);

  const handleMergeAll = useCallback(() => {
    setMergedSet(new Set(files.map((f) => f.name)));
    setActiveTab("merged");
  }, [files]);

  const handleUnmergeAll = useCallback(() => {
    setMergedSet(new Set());
    const first = files[0];
    if (first) setActiveTab(first.name);
  }, [files]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer?.files?.length) void uploadFiles(e.dataTransfer.files, toast);
    },
    [toast],
  );

  if (!session) {
    return (
      <div className="boot">
        <div className="boot-brand">
          <BrandMark size={20} />
          <span>
            log<em>scope</em>
          </span>
        </div>
        {error ? (
          <>
            <div className="boot-err">Couldn’t reach the logscope server.</div>
            <div className="boot-sub">{error}</div>
            <button className="btn pri" onClick={() => location.reload()}>Retry</button>
          </>
        ) : (
          <>
            <div className="boot-spin" aria-hidden="true" />
            <div className="boot-sub">Connecting to the local session…</div>
          </>
        )}
      </div>
    );
  }

  const landing = files.length === 0;
  const showDetail = detailOpen && selected;

  return (
    <div
      className="app"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <Header
        fileCount={files.length}
        activeCount={files.filter((f) => !filters.offFiles.has(f.name)).length}
        recentCount={recentFiles.size}
        filePanelOpen={filePanelOpen}
        onOpenFiles={() => setFilePanelOpen((v) => !v)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        expanded={headerExpanded}
        onToggleExpanded={() => setHeaderExpanded((v) => !v)}
        sideOn={sideOn}
        onToggleSide={() => setSideOn((s) => !s)}
        detailOn={detailOpen}
        onToggleDetail={() => setDetailOpen((v) => !v)}
        detailPos={detailPos}
        onToggleDetailPos={() => setDetailPos((p) => (p === "bottom" ? "right" : "bottom"))}
      />
      {filePanelOpen && (
        <FilePanel
          files={files}
          fileLabels={fileLabels}
          fileColors={fileColors}
          recentFiles={recentFiles}
          activeTab={activeTab}
          onOpenTab={openTab}
          onRenameFile={renameFile}
          onRemoveFile={removeFile}
          onUploaded={toast}
          onClose={() => setFilePanelOpen(false)}
        />
      )}

      {landing ? (
        <div className="drop">
          <div className={"dropin" + (dragOver ? " over" : "")}>
            <div className="dropicon">
              <BrandMark size={46} hollow />
            </div>
            <h1>log<em>scope</em></h1>
            <p>Reassembles fragmented CloudWatch exports into readable, traceable events.</p>
            <div className="dropcta">
              <button className="btn pri lg" onClick={() => setFilePanelOpen(true)}>⊕ Open log files</button>
            </div>
            <div className="dropnote">
              …or drop <b>.json</b> · <b>.ndjson</b> · <b>.csv</b> · <b>.log</b> exports anywhere on this window,
              <br />
              or into the folder logscope is watching — new files appear live.
              <br />
              Nothing is uploaded off this machine or written to disk.
            </div>
          </div>
        </div>
      ) : (
        <>
          <FileTabs
            files={files}
            fileLabels={fileLabels}
            fileColors={fileColors}
            tabOrder={tabOrder}
            activeTab={activeTab}
            mergedSet={mergedSet}
            recentFiles={recentFiles}
            onTabClick={handleTabClick}
            onAddToMerge={handleAddToMerge}
            onRemoveFromMerge={handleRemoveFromMerge}
            onMergeAll={handleMergeAll}
            onUnmergeAll={handleUnmergeAll}
            closedTabs={closedTabs}
            onDismissTab={dismissTab}
            onRemoveFile={removeFile}
            onReorder={setTabOrder}
          />
          <Ribbon
            events={events}
            inView={inView}
            t0={t0}
            t1={t1}
            tz={tz}
            range={filters.range}
            theme={theme}
            onBrush={onBrush}
          />
          <Toolbar
            ref={searchRef}
            q={qInput}
            onQ={setQInput}
            resultCount={view.length}
            levels={filters.levels}
            levelCounts={levelCounts}
            onToggleLevel={toggleLevel}
            tz={tz}
            onTz={setTz}
            sort={sort}
            onSort={setSort}
            onExportEvidence={() => {
              const redacted = exportEvidence(view, { sources, filter: filterDesc });
              toast(`Evidence bundle: ${view.length} events, ${redacted} redacted`, "success");
            }}
            onExportShare={() => {
              exportShare(view, { sources, filter: filterDesc });
              toast(`Shared ${view.length} events (as-is)`, "success");
            }}
            onExportJSON={() => toast(`Exported ${exportViewJSON(view)} events`, "success")}
          />
          <FilterChips
            q={filters.q}
            levels={filters.levels}
            rid={filters.rid}
            sig={filters.sig}
            range={filters.range}
            onClearQ={() => { setQInput(""); setFilters((f) => ({ ...f, q: "" })); }}
            onClearLevel={clearLevel}
            onClearRid={() => setFilters((f) => ({ ...f, rid: null }))}
            onClearSig={() => setFilters((f) => ({ ...f, sig: null }))}
            onClearRange={() => setFilters((f) => ({ ...f, range: null }))}
            onClearAll={clearAllFilters}
          />
          <div className="body">
            {sideOn && (
              <>
                <Sidebar
                  rids={rids}
                  sigs={sigs}
                  activeRid={filters.rid}
                  activeSig={filters.sig}
                  onPickRid={(rid) => setFilters((f) => ({ ...f, rid: f.rid === rid ? null : rid }))}
                  onPickSig={(sig) => setFilters((f) => ({ ...f, sig: f.sig === sig ? null : sig }))}
                  onClear={() => setFilters((f) => ({ ...f, rid: null, sig: null }))}
                  width={sideWidth}
                />
                <div
                  className="resize-v"
                  onMouseDown={(e) => onSideResize(e, "x")}
                />
              </>
            )}
            <div className="main">
              <ViewTabs mode={mode} onMode={setMode} />
              {mode === "log" && activeTab === "merged" && mergedSet.size === 0 ? (
                <div className="empty">
                  Merged view is empty.
                  <br />
                  Open a file tab, or right-click a tab → “Add to merged view”, or use “Merge all”.
                </div>
              ) : mode === "log" && (
                <div className={"log-area" + (showDetail && detailPos === "right" ? " log-area-split" : "")}>
                  <LogTable
                    view={view}
                    selId={selId}
                    tz={tz}
                    base={t0}
                    q={filters.q}
                    sort={sort}
                    scrollRef={scrollRef}
                    recentFiles={recentFiles}
                    fileColors={fileColors}
                    showColors={showColors}
                    mergedFiles={mergedFiles}
                    onIsolateFile={handleTabClick}
                    onSelect={select}
                    onSortColumn={onSortColumn}
                  />
                  {showDetail && (
                    <>
                      <div
                        className={detailPos === "bottom" ? "resize-h" : "resize-v"}
                        onMouseDown={(e) =>
                          detailPos === "bottom"
                            ? onDetailHeightResize(e, "y", true)
                            : onDetailWidthResize(e, "x", true)
                        }
                      />
                      <DetailPanel
                        event={selected}
                        pos={detailPos}
                        panelSize={detailPos === "bottom" ? detailHeight : detailWidth}
                        copy={copy}
                        onCopyJSON={() =>
                          copy(selected.parsed ? JSON.stringify(selected.payload, null, 2) : selected.text, "JSON")
                        }
                        onTrace={() => {
                          if (selected.rid) {
                            setFilters((f) => ({ ...f, rid: selected.rid, range: null }));
                            toast("Filtered to request " + selected.rid.slice(0, 12));
                          }
                        }}
                        onClose={() => {
                          setDetailOpen(false);
                          setSelId(-1);
                        }}
                      />
                    </>
                  )}
                </div>
              )}
              {mode === "waterfall" &&
                (activeTrace ? (
                  <Waterfall trace={activeTrace} tz={tz} />
                ) : (
                  <div className="empty">Select a request (sidebar or a row) to see its waterfall.</div>
                ))}
              {mode === "agent" &&
                (activeTrace ? (
                  <AgentTreeView trace={activeTrace} />
                ) : (
                  <div className="empty">Select a request to see its agent iteration tree.</div>
                ))}
              {mode === "diff" &&
                (traces.length >= 2 ? (
                  <RunDiff traces={traces} initial={filters.rid} />
                ) : (
                  <div className="empty">Need at least two requests to diff.</div>
                ))}
              {mode === "golden" && (
                <GoldenPathView
                  traces={traces}
                  onPickRid={(rid) => {
                    setFilters((f) => ({ ...f, rid }));
                    setMode("waterfall");
                  }}
                />
              )}
              {mode === "concurrency" && <ConcurrencyLens traces={traces} tz={tz} theme={theme} />}
            </div>
          </div>
          <StatusBar
            viewCount={view.length}
            total={events.length}
            rejoinedRows={rejoined.rows}
            rejoinedEvents={rejoined.events}
            errorsInView={errorsInView}
            rid={filters.rid}
            range={filters.range}
            tz={tz}
            connected={connected}
            warnings={warnings}
            onHelp={() => setShowShortcuts(true)}
          />
        </>
      )}

      {showShortcuts && <Shortcuts onClose={() => setShowShortcuts(false)} />}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
