import { useEffect, useRef, useState } from "react";
import type { LogFile } from "@core/index.ts";
import { uploadFile } from "../lib/api.ts";
import { getFileColor } from "./FileTabs.tsx";

const SUPPORTED = /\.(json|ndjson|csv|txt|log)$/i;

// Progress of an in-flight upload, shown as an animated bar in the panel.
export interface UploadItem {
  name: string;
  status: "reading" | "done" | "error";
}

// ─── Single file entry ────────────────────────────────────────────────────────

interface EntryProps {
  file: LogFile;
  label: string;
  color: string;
  isRecent: boolean;
  isActive: boolean;
  onOpen: () => void;
  onRename: (newLabel: string) => void;
  onRemove: () => void;
}

function FileEntry({ file, label, color, isRecent, isActive, onOpen, onRename, onRemove }: EntryProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) onRename(trimmed);
    else setDraft(label);
    setEditing(false);
  };

  const startEdit = () => {
    setDraft(label);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  };

  const renamed = label !== file.name;

  return (
    <div
      className={"fp-entry" + (isRecent ? " fp-entry-new" : "") + (isActive ? " fp-entry-active" : "")}
      onDoubleClick={() => { if (!editing) onOpen(); }}
      title="Double-click to open as a tab"
    >
      {/* Colour chip identifies the file's tab colour */}
      <span className="fp-chip" style={{ background: color }} />

      {/* File info */}
      <div className="fp-info">
        {editing ? (
          <input
            ref={inputRef}
            className="fp-rename-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setDraft(label); setEditing(false); }
            }}
          />
        ) : (
          <span
            className="fp-name"
            title={renamed ? `Original filename: ${file.name}` : "Double-click name to rename"}
            onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
          >
            {label}
            {renamed && <span className="fp-orig"> ← {file.name}</span>}
          </span>
        )}
        <span className="fp-meta">{(file.count ?? 0).toLocaleString()} events</span>
      </div>

      {isRecent && <span className="fp-badge">NEW</span>}

      {/* Actions */}
      <div className="fp-acts">
        {confirming ? (
          <>
            <span className="fp-confirm-lbl">Remove?</span>
            <button
              className="ibtn sm"
              style={{ color: "var(--rose)" }}
              title="Yes, remove from session"
              onClick={(e) => { e.stopPropagation(); setConfirming(false); onRemove(); }}
            >✓</button>
            <button className="ibtn sm" title="Cancel" onClick={(e) => { e.stopPropagation(); setConfirming(false); }}>✕</button>
          </>
        ) : (
          <>
            <button className="ibtn sm" title="Open as tab" onClick={(e) => { e.stopPropagation(); onOpen(); }}>⊞</button>
            <button className="ibtn sm" title="Rename display label" onClick={(e) => { e.stopPropagation(); startEdit(); }}>✎</button>
            <button className="ibtn sm" title="Remove from session" onClick={(e) => { e.stopPropagation(); setConfirming(true); }}>✕</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface FilePanelProps {
  files: LogFile[];
  fileLabels: Record<string, string>;
  fileColors: Record<string, string>;
  recentFiles: Set<string>;
  activeTab: string | "merged";
  onOpenTab: (name: string) => void;
  onRenameFile: (name: string, label: string) => void;
  onRemoveFile: (name: string) => void;
  onUploaded: (msg: string) => void;
  onClose: () => void;
}

export function FilePanel({
  files, fileLabels, fileColors, recentFiles, activeTab,
  onOpenTab, onRenameFile, onRemoveFile, onUploaded, onClose,
}: FilePanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", kd);
    return () => document.removeEventListener("keydown", kd);
  }, [onClose]);

  // Upload with per-file progress, then clear the progress list shortly after.
  const ingest = async (list: FileList | File[]) => {
    const arr = [...list].filter((f) => SUPPORTED.test(f.name));
    if (!arr.length) {
      onUploaded("No supported files — need .json, .ndjson, .csv or .log");
      return;
    }
    setUploads(arr.map((f) => ({ name: f.name, status: "reading" as const })));
    let ok = 0;
    for (const f of arr) {
      try {
        await uploadFile(f.name, await f.text());
        ok++;
        setUploads((u) => u.map((it) => (it.name === f.name ? { ...it, status: "done" } : it)));
      } catch {
        setUploads((u) => u.map((it) => (it.name === f.name ? { ...it, status: "error" } : it)));
        onUploaded("Could not read " + f.name);
      }
    }
    if (ok) onUploaded(`Ready — added ${ok} file${ok > 1 ? "s" : ""}`);
    // Leave the "done" state visible briefly, then clear.
    setTimeout(() => setUploads([]), 1600);
  };

  const busy = uploads.some((u) => u.status === "reading");

  return (
    <>
      <div className="fp-backdrop" onClick={onClose} />
      <div className="fp-panel">
        {/* Header */}
        <div className="fp-hd">
          <span className="fp-title">◧ Log Files</span>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto", alignItems: "center" }}>
            <button className="btn sm" onClick={() => fileInput.current?.click()}>
              ⊕ Add files
            </button>
            <button className="ibtn" title="Close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={"fp-drop" + (dragOver ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer?.files?.length) void ingest(e.dataTransfer.files);
          }}
          onClick={() => fileInput.current?.click()}
        >
          <span className="fp-drop-icon">⊕</span>
          <span className="fp-drop-label">Drop files or click to browse</span>
          <span className="fp-drop-hint">.json · .ndjson · .csv · .log</span>
        </div>

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="fp-progress">
            {busy && <div className="fp-progress-bar" />}
            {uploads.map((u) => (
              <div key={u.name} className={"fp-progress-row fp-" + u.status}>
                <span className="fp-progress-ic">
                  {u.status === "reading" ? <span className="fp-spinner" /> : u.status === "done" ? "✓" : "✕"}
                </span>
                <span className="fp-progress-name">{u.name}</span>
                <span className="fp-progress-st">
                  {u.status === "reading" ? "reading & parsing…" : u.status === "done" ? "ready" : "failed"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* File list header */}
        {files.length > 0 && (
          <div className="fp-list-hd">
            <span className="fp-list-count">
              {files.length} file{files.length !== 1 ? "s" : ""} loaded
            </span>
            <span className="fp-list-hint">double-click to open</span>
          </div>
        )}

        {/* File list */}
        <div className="fp-list">
          {files.length === 0 ? (
            <div className="fp-empty">
              No files loaded yet.
              <br />
              Drop a log export above to start.
            </div>
          ) : (
            files.map((f, i) => (
              <FileEntry
                key={f.name}
                file={f}
                label={fileLabels[f.name] ?? f.name}
                color={fileColors[f.name] ?? getFileColor(i)}
                isRecent={recentFiles.has(f.name)}
                isActive={activeTab === f.name}
                onOpen={() => onOpenTab(f.name)}
                onRename={(label) => onRenameFile(f.name, label)}
                onRemove={() => onRemoveFile(f.name)}
              />
            ))
          )}
        </div>

        {/* Footer note */}
        <div className="fp-foot">
          Files persist for this session only — nothing is written to disk.
          <br />
          Rename changes display labels only, not the file on disk.
        </div>

        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".json,.ndjson,.csv,.txt,.log"
          hidden
          onChange={(e) => {
            if (e.target.files) void ingest(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}
