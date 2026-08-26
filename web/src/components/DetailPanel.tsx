import { useEffect, useRef, useState } from "react";
import type { LogEvent } from "@core/index.ts";
import { formatTime } from "../lib/format.ts";
import { JsonTree } from "./JsonTree.tsx";

interface Props {
  event: LogEvent;
  pos: "bottom" | "right";
  panelSize: number;
  onCopyJSON: () => void;
  onTrace: () => void;
  onClose: () => void;
  copy: (text: string, label: string) => void;
}

function colorizeJson(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="jk">$1</span>:')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="js">$1</span>')
    .replace(/:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, ': <span class="jn">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="jb">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="ju">$1</span>');
}

function buildPopoutHtml(e: LogEvent): string {
  const raw = e.parsed ? JSON.stringify(e.payload, null, 2) : e.text;
  const body = e.parsed ? colorizeJson(raw) : raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>logscope — ${e.level.toUpperCase()} @ ${formatTime(e.t, "ist")}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;background:#14171c;color:#dce2ea;font-family:'IBM Plex Mono','Consolas',monospace;font-size:13px}
    .meta{padding:10px 16px;border-bottom:1px solid #2c333d;background:#1b1f26;display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#8894a3;flex-shrink:0}
    .meta b{color:#dce2ea;font-weight:500}
    .meta .lv-error{color:#e4676f}.meta .lv-warn{color:#e2a33e}.meta .lv-info{color:#7bb661}.meta .lv-debug{color:#5b6673}
    .wrap{display:flex;flex-direction:column;height:100%}
    .body{overflow:auto;padding:14px 16px;flex:1}
    pre{line-height:1.72;white-space:pre-wrap;word-break:break-word}
    .jk{color:#52c7d8}.js{color:#7bb661}.jn{color:#e2a33e}.jb{color:#9b8bf4}.ju{color:#5b6673}
    button{background:#232830;border:1px solid #3a424e;border-radius:4px;color:#8894a3;cursor:pointer;font-size:11px;padding:3px 9px;margin-left:8px}
    button:hover{color:#dce2ea;border-color:#52c7d8}
  </style>
</head>
<body>
<div class="wrap">
  <div class="meta">
    <span class="lv-${e.level}"><b>${e.level.toUpperCase()}</b></span>
    <span><b>IST</b> ${formatTime(e.t, "ist")}</span>
    <span><b>UTC</b> ${formatTime(e.t, "utc")}</span>
    ${e.rid ? `<span><b>request</b> ${e.rid}</span>` : ""}
    <span><b>file</b> ${e.file}</span>
    <span><b>rows</b> ${e.frags}</span>
    <span style="margin-left:auto"><button onclick="navigator.clipboard.writeText(document.querySelector('pre').innerText).then(()=>this.textContent='Copied!',()=>this.textContent='Failed')">Copy</button></span>
  </div>
  <div class="body"><pre>${body}</pre></div>
</div>
</body>
</html>`;
}

export function DetailPanel({ event: e, pos, panelSize, onCopyJSON, onTrace, onClose, copy }: Props) {
  const [treeKey, setTreeKey] = useState(0);
  const [defaultDepth, setDefaultDepth] = useState(2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDefaultDepth(2);
    setTreeKey(0);
  }, [e.id]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!panelRef.current) return;
    if (!document.fullscreenElement) {
      panelRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const popOut = () => {
    const w = window.open("", "_blank", "width=920,height=680,scrollbars=yes,resizable=yes");
    if (!w) return;
    w.document.write(buildPopoutHtml(e));
    w.document.close();
  };

  const sizeStyle =
    pos === "bottom" ? { height: panelSize, maxHeight: "none" as const } : { width: panelSize };

  return (
    <div
      ref={panelRef}
      className={"detail" + (pos === "right" ? " detail-right" : "")}
      style={sizeStyle}
    >
      <div className="dhd">
        <div className="dmeta">
          <span><b>IST</b> {formatTime(e.t, "ist")}</span>
          <span><b>UTC</b> {formatTime(e.t, "utc")}</span>
          <span><b>rows</b> {e.frags}</span>
          <span><b>json</b> {e.parsed ? "recovered" : "plain text"}</span>
          {e.rid && <span><b>request</b> {e.rid}</span>}
          <span><b>file</b> {e.file}</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexShrink: 0 }}>
          {e.parsed && (
            <>
              <button
                className="btn sm"
                title="Expand all nodes"
                onClick={() => { setDefaultDepth(100); setTreeKey((k) => k + 1); }}
              >
                ⊞
              </button>
              <button
                className="btn sm"
                title="Collapse all nodes"
                onClick={() => { setDefaultDepth(1); setTreeKey((k) => k + 1); }}
              >
                ⊟
              </button>
            </>
          )}
          <button className="btn sm" title="Pop out in new window" onClick={popOut}>↗</button>
          <button
            className="btn sm"
            title={isFullscreen ? "Exit full screen" : "Full screen"}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? "⊠" : "⛶"}
          </button>
          <button className="btn sm" onClick={onCopyJSON}>Copy JSON</button>
          {e.rid && <button className="btn sm" onClick={onTrace}>Trace</button>}
          <button className="btn sm" onClick={onClose} title="Close">✕</button>
        </div>
      </div>
      <div className="dbody">
        {e.parsed ? (
          <JsonTree key={treeKey} value={e.payload} copy={copy} defaultDepth={defaultDepth} />
        ) : (
          <pre className="json">{e.text}</pre>
        )}
      </div>
    </div>
  );
}
