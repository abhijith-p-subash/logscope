import { useEffect, useRef } from "react";
import { concurrency, type Trace } from "@core/index.ts";
import { formatTime, type TimeMode } from "../../lib/format.ts";

/** Area chart of how many traces were in flight over time. */
export function ConcurrencyLens({ traces, tz, theme }: { traces: Trace[]; tz: TimeMode; theme: "dark" | "light" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const c = concurrency(traces, 240);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const w = cv.clientWidth || 800;
    const h = 220;
    const dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const x = cv.getContext("2d");
    if (!x) return;
    x.scale(dpr, dpr);
    x.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement);
    const C = (n: string) => css.getPropertyValue(n).trim();
    if (!c.series.length) return;

    const N = c.series.length;
    const bw = w / N;
    const max = Math.max(c.max, 1);
    const pad = 20;
    const plotH = h - pad * 2;

    x.strokeStyle = C("--line");
    x.beginPath();
    x.moveTo(0, h - pad);
    x.lineTo(w, h - pad);
    x.stroke();

    x.beginPath();
    x.moveTo(0, h - pad);
    c.series.forEach((v, i) => {
      const y = h - pad - (v / max) * plotH;
      x.lineTo(i * bw, y);
    });
    x.lineTo(w, h - pad);
    x.closePath();
    x.fillStyle = C("--cyan");
    x.globalAlpha = 0.28;
    x.fill();
    x.globalAlpha = 1;
    x.strokeStyle = C("--cyan");
    x.lineWidth = 1.5;
    x.beginPath();
    c.series.forEach((v, i) => {
      const y = h - pad - (v / max) * plotH;
      if (i === 0) x.moveTo(i * bw, y);
      else x.lineTo(i * bw, y);
    });
    x.stroke();

    x.fillStyle = C("--faint");
    x.font = "10px ui-monospace, monospace";
    x.fillText(`peak ${c.max}`, 6, pad - 4);
  }, [traces, theme, c.max]);

  return (
    <div style={{ padding: "10px 14px", flex: 1, overflow: "auto" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--dim)", marginBottom: 6 }}>
        CONCURRENCY · {traces.length} requests · peak {c.max} in flight
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", height: 220, display: "block" }} />
      {c.series.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--faint)", marginTop: 4 }}>
          <span>{formatTime(c.t0, tz === "rel" ? "ist" : tz)}</span>
          <span>{formatTime(c.t1, tz === "rel" ? "ist" : tz)}</span>
        </div>
      )}
    </div>
  );
}
