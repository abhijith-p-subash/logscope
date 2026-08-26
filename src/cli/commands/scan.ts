/**
 * `logscope scan <path>` — parse logs and print a trace-oriented summary to the
 * terminal. Proves the engine end to end with no UI.
 *
 * `--json` emits a machine-readable summary and exits non-zero when errors are
 * present, so a QA pipeline can fail a build on unexpected log errors (CI mode).
 */
import { formatGap, ingestFiles, type Session } from "../../core/index.ts";
import { collectInputs } from "../io.ts";
import { c } from "../tty.ts";

export interface ScanOptions {
  json?: boolean;
}

/** Machine-readable scan output (the `--json` shape). */
export interface ScanReport {
  files: Array<{
    name: string;
    events: number;
    format: string;
    rejoined: number;
    truncated: boolean;
  }>;
  summary: {
    files: number;
    events: number;
    traces: number;
    errors: number;
    rejoined: number;
  };
  traces: Array<{
    rid: string;
    events: number;
    start: number;
    end: number;
    durationMs: number;
    errors: number;
  }>;
  signatures: Array<{ sig: string; count: number }>;
  warnings: string[];
}

/** Build the report from an ingested session. Pure — no I/O, unit-testable. */
export function buildReport(session: Session): ScanReport {
  // Single pass over events: per-file rejoin counts, total errors, total
  // rejoins — instead of scanning all events once per file (O(files × events)).
  const rejoinedByFile = new Map<string, number>();
  let errors = 0;
  let rejoined = 0;
  for (const e of session.events) {
    const r = e.frags - 1;
    rejoined += r;
    if (r) rejoinedByFile.set(e.file, (rejoinedByFile.get(e.file) ?? 0) + r);
    if (e.level === "error") errors++;
  }

  const files = session.files.map((f) => ({
    name: f.name,
    events: f.count,
    format: session.diagnostics[f.name]?.format ?? "text",
    rejoined: rejoinedByFile.get(f.name) ?? 0,
    truncated: session.diagnostics[f.name]?.truncated ?? false,
  }));

  const traces = session.traces.map((t) => ({
    rid: t.rid,
    events: t.events.length,
    start: t.start,
    end: t.end,
    durationMs: t.duration,
    errors: t.errorCount,
  }));

  const warnings = Object.values(session.diagnostics).flatMap((d) => d.warnings);

  return {
    files,
    summary: { files: files.length, events: session.events.length, traces: traces.length, errors, rejoined },
    traces,
    signatures: session.signatures,
    warnings,
  };
}

/** Run the scan and write output. Returns the intended process exit code. */
export function runScan(target: string, opts: ScanOptions): number {
  let inputs;
  try {
    inputs = collectInputs(target);
  } catch (e) {
    process.stderr.write((e as Error).message + "\n");
    return 2;
  }

  const session = ingestFiles(inputs);
  const report = buildReport(session);

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    // CI mode: non-zero exit when errors are present.
    return report.summary.errors > 0 ? 1 : 0;
  }

  process.stdout.write(renderHuman(report, target));
  return 0;
}

const TRACE_LIMIT = 40;
const SIG_LIMIT = 15;

function renderHuman(r: ScanReport, target: string): string {
  const out: string[] = [];
  const s = r.summary;

  out.push("");
  out.push(`  ${c.bold("logscope scan")} ${c.dim(target)}`);
  out.push("");
  /** "1 event" / "2 events" — the summary line reads as prose, so it agrees. */
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;
  out.push(
    "  " +
      [
        `${c.bold(String(s.events))} ${s.events === 1 ? "event" : "events"}`,
        `${c.bold(String(s.traces))} ${s.traces === 1 ? "trace" : "traces"}`,
        s.errors ? c.red(plural(s.errors, "error")) : c.green("0 errors"),
        s.rejoined ? c.cyan(`${plural(s.rejoined, "row")} rejoined`) : "",
        c.dim(plural(s.files, "file")),
      ]
        .filter(Boolean)
        .join(c.dim("  ·  ")),
  );

  // Files
  out.push("");
  out.push(c.dim("  FILES"));
  const nameW = Math.min(34, Math.max(...r.files.map((f) => f.name.length), 4));
  for (const f of r.files) {
    const extra = [
      f.rejoined ? c.cyan(`${f.rejoined} rejoined`) : "",
      f.truncated ? c.yellow("truncated?") : "",
    ]
      .filter(Boolean)
      .join("  ");
    out.push(
      "  " +
        f.name.padEnd(nameW + 2) +
        String(f.events).padStart(6) +
        " events  " +
        c.dim(f.format.padEnd(9)) +
        extra,
    );
  }

  // Traces — the point of the tool. Most-interesting first: errors, then slow.
  const traces = [...r.traces].sort(
    (a, b) => b.errors - a.errors || b.durationMs - a.durationMs || a.rid.localeCompare(b.rid),
  );
  out.push("");
  out.push(c.dim(`  TRACES (${traces.length})`));
  if (!traces.length) {
    out.push("  " + c.dim("no correlation ids found — nothing to group by"));
  } else {
    const ridW = Math.min(28, Math.max(...traces.map((t) => t.rid.length), 4));
    for (const t of traces.slice(0, TRACE_LIMIT)) {
      const mark = t.errors ? c.red("✗") : c.green("✓");
      const errTxt = t.errors ? c.red(`${t.errors} err`) : c.dim("ok");
      out.push(
        "  " +
          mark +
          " " +
          c.violet(t.rid.padEnd(ridW)) +
          String(t.events).padStart(4) +
          " evt  " +
          formatGap(t.durationMs).padStart(8) +
          "  " +
          errTxt,
      );
    }
    if (traces.length > TRACE_LIMIT) {
      out.push("  " + c.dim(`… and ${traces.length - TRACE_LIMIT} more`));
    }
  }

  // Error signatures
  if (r.signatures.length) {
    out.push("");
    out.push(c.dim(`  ERROR SIGNATURES (${r.signatures.length})`));
    for (const sig of r.signatures.slice(0, SIG_LIMIT)) {
      out.push("  " + c.red(`${sig.count}×`.padStart(5)) + "  " + sig.sig);
    }
    if (r.signatures.length > SIG_LIMIT) {
      out.push("  " + c.dim(`… and ${r.signatures.length - SIG_LIMIT} more`));
    }
  }

  // Warnings
  if (r.warnings.length) {
    out.push("");
    out.push(c.yellow("  WARNINGS"));
    for (const w of r.warnings) out.push("  " + c.yellow("! ") + w);
  }

  out.push("");
  return out.join("\n") + "\n";
}
