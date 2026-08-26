import { buildEvidenceBundle, defaultRedaction, previewRedaction, type LogEvent } from "@core/index.ts";
import { formatTime } from "./format.ts";

function download(name: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Export the current filtered view as JSON with dual IST/UTC timestamps. */
export function exportViewJSON(view: LogEvent[]): number {
  const out = view.map((e) => ({
    timestamp_ist: formatTime(e.t, "ist"),
    timestamp_utc: new Date(e.t).toISOString(),
    level: e.level,
    request_id: e.rid,
    rows_rejoined: e.frags,
    source_file: e.file,
    title: e.title,
    payload: e.parsed ? e.payload : e.text,
  }));
  download("logscope-events.json", JSON.stringify(out, null, 2), "application/json");
  return out.length;
}

interface BundleMeta {
  sources: string[];
  filter: string;
}

/**
 * Evidence bundle: self-contained, PII-redacted HTML for a defect ticket.
 * Returns how many events had content redacted (for the confirmation toast).
 */
export function exportEvidence(view: LogEvent[], meta: BundleMeta): number {
  const cfg = defaultRedaction();
  const html = buildEvidenceBundle(view, {
    title: "Log evidence",
    sources: meta.sources,
    filter: meta.filter,
    redact: cfg,
  });
  download("log-evidence.html", html, "text/html");
  return previewRedaction(view, cfg).changed;
}

/** Share the current view as-is (no redaction) — quickest way to hand off a view. */
export function exportShare(view: LogEvent[], meta: BundleMeta): number {
  const html = buildEvidenceBundle(view, {
    title: "Logscope session",
    sources: meta.sources,
    filter: meta.filter,
    redact: null,
  });
  download("logscope-session.html", html, "text/html");
  return view.length;
}
