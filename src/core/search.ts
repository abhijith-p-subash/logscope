/**
 * Search: query parsing, matching, and safe highlighting.
 *
 * Query grammar:
 *  - bare terms         substring match, ANDed together (case-insensitive)
 *  - `"quoted phrase"`  literal phrase (spaces preserved)
 *  - `-term`            exclude (negate any term, including fields/regex/phrases)
 *  - `/pattern/flags`   regex; invalid regex degrades to a literal search, never throws
 *  - `field:value`      scoped match. Known fields: level, rid/req, file, sig,
 *                       msg/text, title. Any other name searches the JSON payload
 *                       for a matching key (depth-limited), falling back to text.
 *  - `a | b` / `a OR b` OR-groups: the event matches if ANY group matches. Within
 *                       a group, include-terms AND and exclude-terms must be absent.
 *
 * Log content is untrusted and will contain `<` and `>`. Highlighting MUST
 * escape HTML *before* inserting `<mark>` markup — this is a real XSS vector.
 */

import type { LogEvent } from "./model.ts";

/** Escape the five HTML-significant characters. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const REGEX_TOKEN = /^(-?)\/(.+)\/([gimsuy]*)$/;
const FIELD_TOKEN = /^(-?)([A-Za-z_][\w.]*):(.*)$/s;

// Tokenizer: quoted-field, quoted phrase, /regex/flags, or a bare run.
// Order matters — the field/quoted forms must win over the bare `\S+` catch-all.
const TOKEN_RE =
  /-?[A-Za-z_][\w.]*:"[^"]*"|-?"[^"]*"|-?\/(?:\\.|[^/])+\/[gimsuy]*|\S+/g;

/** Fields that map directly to a top-level {@link LogEvent} property. */
const DIRECT_FIELDS = new Set(["level", "rid", "req", "file", "sig", "msg", "text", "title"]);

type Term =
  | { neg: boolean; kind: "text"; value: string }
  | { neg: boolean; kind: "regex"; re: RegExp | null; raw: string }
  | { neg: boolean; kind: "field"; field: string; value: string };

/** Strip a single layer of surrounding double quotes. */
function unquote(s: string): string {
  return s.replace(/^"(.*)"$/s, "$1");
}

function parseToken(tk: string): Term | null {
  const neg = tk.startsWith("-");
  if (neg) tk = tk.slice(1);
  if (!tk) return null;

  // /regex/flags
  const rx = tk.match(/^\/(.+)\/([gimsuy]*)$/);
  if (rx) {
    let re: RegExp | null = null;
    try {
      // Drop stateful `g`/`y`, always case-insensitive.
      const flags = rx[2]!.replace(/[gy]/g, "");
      re = new RegExp(rx[1]!, flags.includes("i") ? flags : flags + "i");
    } catch {
      re = null; // invalid → literal fallback in the matcher
    }
    return { neg, kind: "regex", re, raw: ("-".repeat(0) + "/" + rx[1] + "/" + rx[2]) };
  }

  // field:value  (but treat `scheme://…` and other `x:/…` as plain text, not a field)
  const fm = tk.match(/^([A-Za-z_][\w.]*):(.*)$/s);
  if (fm && !fm[2]!.startsWith("/")) {
    return { neg, kind: "field", field: fm[1]!.toLowerCase(), value: unquote(fm[2]!).toLowerCase() };
  }

  return { neg, kind: "text", value: unquote(tk).toLowerCase() };
}

/** Parse a query into OR-groups of AND-terms. */
function parseGroups(q: string): Term[][] {
  const groups: Term[][] = [];
  let current: Term[] = [];
  for (const raw of q.match(TOKEN_RE) ?? []) {
    if (raw === "|" || raw === "OR") {
      groups.push(current);
      current = [];
      continue;
    }
    const t = parseToken(raw);
    if (t) current.push(t);
  }
  groups.push(current);
  return groups.filter((g) => g.length > 0);
}

/** Walk a payload looking for a key (ci) whose stringified value contains `value`. */
function payloadFieldMatch(payload: unknown, field: string, value: string, depth = 0): boolean {
  if (payload == null || depth > 4) return false;
  if (Array.isArray(payload)) {
    return payload.some((v) => payloadFieldMatch(v, field, value, depth + 1));
  }
  if (typeof payload === "object") {
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (k.toLowerCase() === field) {
        const s =
          v == null
            ? ""
            : typeof v === "object"
              ? JSON.stringify(v)
              : String(v);
        if (s.toLowerCase().includes(value)) return true;
      }
      if (v != null && typeof v === "object" && payloadFieldMatch(v, field, value, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

function fieldValue(e: LogEvent, field: string): string | null {
  switch (field) {
    case "level": return e.level;
    case "rid":
    case "req": return e.rid ?? "";
    case "file": return e.file;
    case "sig": return e.sig ?? "";
    case "msg":
    case "text": return e.text;
    case "title": return e.title;
    default: return null;
  }
}

function termMatches(t: Term, e: LogEvent, hay: string): boolean {
  switch (t.kind) {
    case "text":
      return hay.includes(t.value);
    case "regex":
      return t.re ? t.re.test(e.text) : hay.includes(t.raw.toLowerCase());
    case "field": {
      if (DIRECT_FIELDS.has(t.field)) {
        return (fieldValue(e, t.field) ?? "").toLowerCase().includes(t.value);
      }
      // Generic key search inside the payload; fall back to a text search.
      if (payloadFieldMatch(e.payload, t.field, t.value)) return true;
      return hay.includes(t.value);
    }
  }
}

/**
 * Build a predicate for a query, or `null` for an empty query (matches all).
 * A `/regex/` that fails to compile falls back to a literal search of the token.
 */
export function buildMatcher(q: string): ((e: LogEvent) => boolean) | null {
  q = q.trim();
  if (!q) return null;

  const groups = parseGroups(q);
  if (!groups.length) return null;

  return (e) => {
    const hay = e.text.toLowerCase();
    // OR across groups; within a group include-terms AND, exclude-terms must be absent.
    return groups.some((group) =>
      group.every((t) => {
        const hit = termMatches(t, e, hay);
        return t.neg ? !hit : hit;
      }),
    );
  };
}

/**
 * Escape `text`, then wrap the query's positive terms (literals, field values,
 * and regex matches) in `<mark>`. Always returns HTML-safe output: the `<mark>`
 * only ever wraps already-escaped substrings, so nothing in the log content or
 * the query can inject markup.
 */
export function highlight(text: string, q: string): string {
  const escaped = escapeHtml(text);
  q = q.trim();
  if (!q) return escaped;

  const literalParts: string[] = [];
  const regexParts: string[] = [];

  for (const group of parseGroups(q)) {
    for (const t of group) {
      if (t.neg) continue;
      if (t.kind === "text" && t.value) {
        literalParts.push(escapeHtml(t.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      } else if (t.kind === "field" && t.value) {
        literalParts.push(escapeHtml(t.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      } else if (t.kind === "regex" && t.re) {
        regexParts.push(t.re.source);
      }
    }
  }

  const parts = [...regexParts, ...literalParts].filter(Boolean);
  if (!parts.length) return escaped;

  try {
    const re = new RegExp("(" + parts.join("|") + ")", "gi");
    // `$&` (whole match) avoids capture-group index shifts from regex sources.
    return escaped.replace(re, "<mark>$&</mark>");
  } catch {
    return escaped;
  }
}
