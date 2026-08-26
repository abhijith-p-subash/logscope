import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogEvent } from "@core/index.ts";
import { formatTime, type TimeMode } from "../lib/format.ts";

interface Props {
  events: LogEvent[];
  inView: Set<number>;
  t0: number;
  t1: number;
  tz: TimeMode;
  range: [number, number] | null;
  theme: "dark" | "light";
  onBrush: (range: [number, number] | null) => void;
}

const H = 52;

/**
 * Canvas density strip across the full loaded time range. Grey = everything
 * loaded, accent = what the current filters match, red ticks = errors. Drag to
 * filter by time. Hand-drawn (no chart library) per CLAUDE.md.
 *
 * Perf (W1): colour reads are hoisted out of the per-bar loop; the O(events)
 * histograms are memoized so a filter change only recomputes the accent series,
 * and redraws are coalesced onto a single animation frame.
 */
export const Ribbon = memo(function Ribbon({ events, inView, t0, t1, tz, range, theme, onBrush }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);
  const [width, setWidth] = useState(900);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // Bucket count derives from width; only changes on resize.
  const N = Math.max(60, Math.min(400, Math.floor(width / 3)));
  const span = Math.max(1, t1 - t0);

  // Base histograms (grey + error) — independent of filters, so a search
  // keystroke never re-runs this O(events) pass. Only events / range / N.
  const base = useMemo(() => {
    const all = new Array(N).fill(0);
    const err = new Array(N).fill(0);
    for (const e of events) {
      const b = Math.min(N - 1, Math.max(0, Math.floor(((e.t - t0) / span) * N)));
      all[b]++;
      if (e.level === "error") err[b]++;
    }
    let max = 1;
    for (let i = 0; i < N; i++) if (all[i] > max) max = all[i];
    return { all, err, max };
  }, [events, t0, span, N]);

  // Accent histogram (what current filters match) — recomputed on filter change.
  const sel = useMemo(() => {
    const s = new Array(N).fill(0);
    for (const e of events) {
      if (!inView.has(e.id)) continue;
      const b = Math.min(N - 1, Math.max(0, Math.floor(((e.t - t0) / span) * N)));
      s[b]++;
    }
    return s;
  }, [events, inView, t0, span, N]);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !events.length) return;
    const w = cv.clientWidth || width || 900;
    const dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr;
    cv.height = H * dpr;
    const x = cv.getContext("2d");
    if (!x) return;
    x.scale(dpr, dpr);
    x.clearRect(0, 0, w, H);

    // Colour reads hoisted OUT of the loop (was ~N×3 getComputedStyle calls).
    const css = getComputedStyle(document.documentElement);
    const cLine2 = css.getPropertyValue("--line2").trim();
    const cLine = css.getPropertyValue("--line").trim();
    const cCyan = css.getPropertyValue("--cyan").trim();
    const cRose = css.getPropertyValue("--rose").trim();

    const { all, err, max } = base;
    const bw = w / N;
    for (let i = 0; i < N; i++) {
      const bh = (all[i] / max) * 30;
      if (bh > 0) {
        x.fillStyle = cLine2;
        x.fillRect(i * bw, H - 8 - bh, Math.max(1, bw - 0.5), bh);
      }
      const sh = (sel[i] / max) * 30;
      if (sh > 0) {
        x.fillStyle = cCyan;
        x.globalAlpha = 0.78;
        x.fillRect(i * bw, H - 8 - sh, Math.max(1, bw - 0.5), sh);
        x.globalAlpha = 1;
      }
      if (err[i] > 0) {
        x.fillStyle = cRose;
        x.fillRect(i * bw, H - 6, Math.max(1, bw - 0.5), 4);
      }
    }
    x.strokeStyle = cLine;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(0, H - 7.5);
    x.lineTo(w, H - 7.5);
    x.stroke();
  }, [events, base, sel, width, theme, N]);

  // Coalesce redraws onto a single animation frame.
  const rafRef = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setWidth(cr.width);
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const toT = (px: number): number => {
    const w = canvasRef.current?.clientWidth || 1;
    return t0 + (px / w) * (t1 - t0);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!events.length) return;
    setDrag({ x0: e.nativeEvent.offsetX, x1: e.nativeEvent.offsetX });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const px = e.nativeEvent.offsetX;
    setHoverX(px);
    if (drag) setDrag({ ...drag, x1: px });
  };
  const onMouseUp = () => {
    if (!drag) return;
    const { x0, x1 } = drag;
    setDrag(null);
    if (Math.abs(x1 - x0) < 4) {
      onBrush(null);
      return;
    }
    onBrush([toT(Math.min(x0, x1)), toT(Math.max(x0, x1))]);
  };

  const w = width || 1;
  const selStyle = drag
    ? { left: Math.min(drag.x0, drag.x1), width: Math.abs(drag.x1 - drag.x0) }
    : range
      ? { left: ((range[0] - t0) / span) * w, width: Math.max(2, ((range[1] - range[0]) / span) * w) }
      : null;

  const labelMode: TimeMode = tz === "rel" ? "ist" : tz;

  // Hover readout: time + bucket count under the cursor.
  let hover: { left: number; label: string } | null = null;
  if (hoverX != null && !drag && events.length) {
    const bucket = Math.min(N - 1, Math.max(0, Math.floor((hoverX / w) * N)));
    const count = base.all[bucket] ?? 0;
    hover = {
      left: hoverX,
      label: `${formatTime(toT(hoverX), labelMode)}  ·  ${count.toLocaleString()} event${count === 1 ? "" : "s"}`,
    };
  }

  return (
    <div className="ribbon" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        aria-label="Event density over time — drag to filter by time range"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setHoverX(null); if (drag) onMouseUp(); }}
      />
      <div className="rb-lbl rb-l">{events.length ? formatTime(t0, labelMode) : ""}</div>
      <div className="rb-lbl rb-r">{events.length ? formatTime(t1, labelMode) : ""}</div>
      {hover && (
        <>
          <div className="rb-cursor" style={{ left: hover.left }} />
          <div
            className="rb-tip"
            style={{ left: Math.min(Math.max(hover.left, 4), w - 4), transform: `translateX(${hover.left > w - 140 ? "-100%" : hover.left < 140 ? "0" : "-50%"})` }}
          >
            {hover.label}
          </div>
        </>
      )}
      {selStyle && (
        <div className="rb-sel" style={selStyle}>
          <span className="rb-grip rb-grip-l" />
          <span className="rb-grip rb-grip-r" />
        </div>
      )}
      {range && (
        <button className="btn sm rb-clear" onClick={() => onBrush(null)} title="Clear the time-range filter">
          Clear range
        </button>
      )}
    </div>
  );
});
