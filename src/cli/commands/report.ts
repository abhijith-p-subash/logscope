/**
 * `logscope report <path> --out evidence.html` — generate a self-contained,
 * PII-redacted HTML evidence bundle from logs, with no UI. Writing the output
 * file is an explicit user-triggered export (allowed by the no-persistence rule).
 */
import { writeFileSync } from "node:fs";
import { buildEvidenceBundle, defaultRedaction, ingestFiles } from "../../core/index.ts";
import { collectInputs } from "../io.ts";

export interface ReportOptions {
  out?: string;
  /** commander sets this to false when `--no-redact` is passed. */
  redact?: boolean;
  title?: string;
}

export function runReport(target: string, opts: ReportOptions): number {
  let inputs;
  try {
    inputs = collectInputs(target);
  } catch (e) {
    process.stderr.write((e as Error).message + "\n");
    return 2;
  }

  const session = ingestFiles(inputs);
  const redacted = opts.redact !== false;
  const html = buildEvidenceBundle(session.events, {
    title: opts.title ?? "Log evidence",
    sources: session.files.map((f) => f.name),
    redact: redacted ? defaultRedaction() : null,
  });

  const out = opts.out ?? "evidence.html";
  writeFileSync(out, html);
  process.stdout.write(
    `Wrote ${session.events.length.toLocaleString()} events to ${out}${redacted ? " (PII redacted)" : ""}\n`,
  );
  return 0;
}
