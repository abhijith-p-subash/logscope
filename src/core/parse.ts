/**
 * Format sniffing and the JSON / NDJSON / CSV / Insights parsers.
 *
 * These turn a file's raw text into an array of flat row objects, plus
 * diagnostics. They must never throw on malformed input — any unparseable file
 * degrades to raw text rows with a visible warning (CLAUDE.md constraint 6).
 */

import type { Diagnostics, Format, ParseResult } from "./model.ts";

type Row = Record<string, unknown>;

/** The CloudWatch Insights result cap. Exactly this many rows ≈ truncated data. */
const INSIGHTS_ROW_CAP = 10000;

/** Parse a string as a JSON object/array, or return null. Never throws. */
export function tryJSON(s: string): unknown | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/**
 * A minimal RFC-4180-ish CSV parser. Handles quoted cells, embedded newlines,
 * and escaped double-quotes (`""`). Returns rows as objects keyed by header.
 */
export function parseCSV(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  const len = text.length;
  let i = 0;

  // Extract cells by bulk `slice()` over spans rather than char-by-char `+=`,
  // which is quadratic-risk when CloudWatch stuffs a whole JSON payload into one
  // quoted cell. Escaped `""` is the only case that needs piecewise assembly.
  while (i < len) {
    let cell: string;
    if (text[i] === '"') {
      i++; // opening quote
      let start = i;
      let buf = "";
      let hasEsc = false;
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            buf += text.slice(start, i) + '"';
            i += 2;
            start = i;
            hasEsc = true;
            continue;
          }
          break; // closing quote
        }
        i++;
      }
      cell = hasEsc ? buf + text.slice(start, i) : text.slice(start, i);
      if (i < len && text[i] === '"') i++; // consume closing quote
    } else {
      const start = i;
      while (i < len && text[i] !== "," && text[i] !== "\n") i++;
      let end = i;
      if (end > start && text[end - 1] === "\r") end--; // strip CR from CRLF
      cell = text.slice(start, end);
    }

    row.push(cell);

    if (i < len && text[i] === "\r") i++; // CR after a quoted cell
    if (i >= len) break;
    const sep = text[i++];
    if (sep === "\n") {
      rows.push(row);
      row = [];
    }
    // `,` (or any stray char after a quoted cell) just moves to the next cell.
  }
  if (row.length) rows.push(row);

  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => {
      // CloudWatch CSV flattens nesting: the payload is often JSON inside a cell.
      // We keep the raw string; stitching/recovery re-parses it downstream.
      const obj: Row = {};
      header.forEach((h, i) => {
        obj[h] = r[i] ?? "";
      });
      return obj;
    });
}

/**
 * Walk a parsed JSON structure and extract flat rows, unwrapping the common
 * CloudWatch container shapes: Insights `results` (arrays of `{field,value}`),
 * `events`, and `logStreams`.
 *
 * Sets `insights` to true when the Insights field/value shape is detected.
 */
function extractRows(data: unknown): { rows: Row[]; insights: boolean } {
  const out: Row[] = [];
  let insights = false;

  const isFieldValueRecord = (n: unknown): n is Array<{ field: string; value: unknown }> =>
    Array.isArray(n) &&
    n.length > 0 &&
    typeof n[0] === "object" &&
    n[0] !== null &&
    "field" in (n[0] as object);

  const walk = (n: unknown): void => {
    if (Array.isArray(n)) {
      // Insights `results`: an array of records, each an array of {field,value}.
      if (n.length > 0 && isFieldValueRecord(n[0])) {
        insights = true;
        for (const rec of n as Array<Array<{ field: string; value: unknown }>>) {
          const obj: Row = {};
          for (const f of rec) obj[f.field] = f.value;
          out.push(obj);
        }
        return;
      }
      for (const item of n) walk(item);
      return;
    }
    if (n && typeof n === "object") {
      const o = n as Row;
      if (Array.isArray(o.events)) {
        for (const e of o.events) walk(e);
        return;
      }
      if (Array.isArray(o.results)) {
        walk(o.results);
        return;
      }
      if (Array.isArray(o.logStreams)) {
        for (const s of o.logStreams) walk(s);
        return;
      }
      out.push(o);
    }
  };

  walk(data);
  return { rows: out, insights };
}

/**
 * Parse a file's text into rows plus diagnostics. Detection order:
 *  1. JSON object/array (including Insights `results` and `events` containers)
 *  2. NDJSON — most lines parse as JSON objects
 *  3. CSV — first line looks comma-separated
 *  4. Fallback — every non-empty line becomes a `{message}` row
 *
 * @param name file name (used only for warnings)
 */
export function parseFile(name: string, text: string): ParseResult {
  const warnings: string[] = [];
  const t = text.trim();

  let rows: Row[] | null = null;
  let format: Format = "text";

  if (t === "") {
    return {
      rows: [],
      diagnostics: { format: "text", rowCount: 0, truncated: false, warnings: [`${name} is empty`] },
    };
  }

  // 1. JSON / Insights / container shapes.
  if (t.startsWith("{") || t.startsWith("[")) {
    const d = tryJSON(t);
    if (d) {
      const { rows: extracted, insights } = extractRows(d);
      if (extracted.length) {
        rows = extracted;
        format = insights ? "insights" : "json";
      }
    }
  }

  // Split once and reuse across the NDJSON / CSV / text branches below.
  const rawLines = rows ? [] : t.split("\n");

  // 2. NDJSON — a majority of lines parse as JSON objects. Sample the first
  //    lines for detection rather than JSON.parsing the whole file up front
  //    (wasted work when the file is actually CSV or plain text).
  if (!rows) {
    const trimmed = rawLines.map((l) => l.trim()).filter(Boolean);
    const sampleN = Math.min(trimmed.length, 50);
    let goodInSample = 0;
    for (let i = 0; i < sampleN; i++) if (tryJSON(trimmed[i]!)) goodInSample++;
    if (sampleN && goodInSample > sampleN * 0.6) {
      const good = trimmed.map(tryJSON).filter(Boolean) as Row[];
      if (good.length) {
        rows = good;
        format = "ndjson";
      }
    }
  }

  // 3. CSV — first line looks comma-separated.
  if (!rows && /,/.test(rawLines[0] ?? "")) {
    const csv = parseCSV(t);
    if (csv.length) {
      rows = csv;
      format = "csv";
    }
  }

  // 4. Fallback — raw text lines. Never fails; never throws.
  if (!rows) {
    rows = rawLines.filter(Boolean).map((l) => ({ message: l }));
    format = "text";
  }

  // Truncation heuristic: exactly the Insights cap almost certainly means the
  // export was cut off. Silently showing partial data is worse than warning.
  const truncated = rows.length === INSIGHTS_ROW_CAP;
  if (truncated) {
    warnings.push(
      `${name} has exactly ${INSIGHTS_ROW_CAP.toLocaleString()} rows — it likely hit the CloudWatch Insights result cap and is incomplete.`,
    );
  }

  const diagnostics: Diagnostics = { format, rowCount: rows.length, truncated, warnings };
  return { rows, diagnostics };
}
