/**
 * Self-contained HTML evidence bundle (DECISIONS.md D7 — replaces screenshots).
 *
 * A defect-ready artifact: reconstructed events, dual IST/UTC timestamps,
 * sources, the active filter, error rows highlighted, and PII redaction applied.
 * Pure — returns an HTML string with no external resources, so it opens
 * anywhere offline. Reused by the web export button and the CLI `report`.
 */

import type { LogEvent } from "./model.ts";
import { redactEvent, type RedactionConfig } from "./redact.ts";
import { formatTime } from "./time.ts";

export interface BundleOptions {
  title?: string;
  /** The active search/filter string, recorded for context. */
  filter?: string;
  /** Source file names included. */
  sources?: string[];
  /** Redaction config to apply, or null to export as-is (e.g. quick share). */
  redact?: RedactionConfig | null;
  /** Generation time (epoch ms). Defaults to now. */
  now?: number;
}

/** Escape the three characters that matter for HTML text/element context. */
function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Build a self-contained HTML evidence bundle from a set of events. */
export function buildEvidenceBundle(events: LogEvent[], opts: BundleOptions = {}): string {
  const now = opts.now ?? Date.now();
  const prepared = opts.redact ? events.map((e) => redactEvent(e, opts.redact!)) : events;

  const rows = prepared
    .map((e) => {
      const payload = e.parsed
        ? `<pre>${esc(JSON.stringify(e.payload, null, 2))}</pre>`
        : "";
      return (
        `<tr class="${e.level}">` +
        `<td>${esc(formatTime(e.t, "ist"))}<br><span class="utc">${esc(new Date(e.t).toISOString())}</span></td>` +
        `<td>${e.level}</td>` +
        `<td>${esc(e.rid ?? "")}</td>` +
        `<td><div class="m">${esc(e.title)}</div>${payload}</td>` +
        `</tr>`
      );
    })
    .join("");

  const errorCount = prepared.reduce((n, e) => n + (e.level === "error" ? 1 : 0), 0);
  const meta = [
    `${prepared.length} events`,
    errorCount ? `${errorCount} errors` : "",
    `exported ${esc(formatTime(now, "ist"))} IST`,
    opts.filter ? `filter: ${esc(opts.filter)}` : "",
    opts.redact ? "PII redacted" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const sources = opts.sources?.length ? `<br>Sources: ${esc(opts.sources.join(", "))}` : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title ?? "Log evidence")}</title>
<style>
body{font:13px/1.5 system-ui,-apple-system,sans-serif;margin:24px;color:#1a1f27}
h1{font-size:17px;margin:0 0 4px}
.sub{color:#5a6472;font-size:12px;margin-bottom:16px}
table{border-collapse:collapse;width:100%}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#5a6472;border-bottom:1px solid #ccc;padding:6px}
td{border-bottom:1px solid #eee;padding:6px;vertical-align:top;font-size:12px}
td:nth-child(1){white-space:nowrap;font-family:ui-monospace,Menlo,Consolas,monospace;color:#5a6472;width:190px}
.utc{color:#98a0ac;font-size:10.5px}
td:nth-child(2){width:56px;font-weight:600}
td:nth-child(3){font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;width:150px;color:#5b48c4}
tr.error td:nth-child(2){color:#c0333d}
tr.error{background:#fdf3f4}
tr.warn td:nth-child(2){color:#9a6b10}
pre{background:#f5f6f8;padding:8px;border-radius:4px;font-size:11px;white-space:pre-wrap;word-break:break-word;margin:5px 0 0;max-height:340px;overflow:auto}
.m{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px}
</style></head>
<body>
<h1>${esc(opts.title ?? "Log evidence")}</h1>
<div class="sub">${meta}${sources}</div>
<table><thead><tr><th>Timestamp (IST / UTC)</th><th>Level</th><th>Request</th><th>Event</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}
