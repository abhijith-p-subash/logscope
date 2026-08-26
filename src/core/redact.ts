/**
 * PII redaction.
 *
 * These logs carry client names, employee ids, and financial customer numbers
 * under client MSAs (DECISIONS.md D4). Redaction is applied to every export by
 * default, with a preview so the user can confirm before sharing.
 *
 * Pure logic: takes values in, returns redacted copies out. Never mutates input.
 */

import type { LogEvent } from "./model.ts";

/** A single find-and-replace rule applied to string values. */
export interface RedactionRule {
  name: string;
  /** Must be a global (`/g`) regex. */
  pattern: RegExp;
  replacement: string;
}

export interface RedactionConfig {
  rules: RedactionRule[];
  /** Field names whose value is redacted entirely, regardless of content. */
  idFields: string[];
}

/** Sensible defaults: emails, long digit runs, phone-ish numbers. */
export const DEFAULT_RULES: RedactionRule[] = [
  { name: "email", pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replacement: "‹email›" },
  {
    name: "long-digits",
    // 6+ digit runs (account/customer/employee numbers), not inside a longer word.
    pattern: /(?<![\w.])\d{6,}(?![\w.])/g,
    replacement: "‹num›",
  },
];

/** Field names that are redacted wholesale (case-insensitive substring match). */
export const DEFAULT_ID_FIELDS = [
  "ssn",
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "creditcard",
  "credit_card",
  "email",
  "phone",
  "employeeid",
  "employee_id",
  "customerid",
  "customer_id",
  "customername",
  "customer_name",
];

export const defaultRedaction = (): RedactionConfig => ({
  rules: DEFAULT_RULES.map((r) => ({ ...r })),
  idFields: [...DEFAULT_ID_FIELDS],
});

const REDACTED = "‹redacted›";

/** Apply all pattern rules to a string. */
export function redactString(s: string, rules: RedactionRule[]): string {
  let out = s;
  for (const rule of rules) out = out.replace(rule.pattern, rule.replacement);
  return out;
}

/** True if `key` looks like a sensitive id field. */
function isIdField(key: string, idFields: string[]): boolean {
  const k = key.toLowerCase();
  return idFields.some((f) => k === f || k.includes(f));
}

/** Deep-redact any value, returning a new copy. Objects/arrays are cloned. */
export function redactValue(value: unknown, config: RedactionConfig): unknown {
  if (typeof value === "string") return redactString(value, config.rules);
  if (Array.isArray(value)) return value.map((v) => redactValue(v, config));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isIdField(k, config.idFields) && v != null ? REDACTED : redactValue(v, config);
    }
    return out;
  }
  return value;
}

/** Return a redacted copy of an event (title, text, and payload). */
export function redactEvent(e: LogEvent, config: RedactionConfig): LogEvent {
  return {
    ...e,
    title: redactString(e.title, config.rules),
    text: redactString(e.text, config.rules),
    payload: e.parsed ? redactValue(e.payload, config) : null,
  };
}

/**
 * Count how many events would change under redaction, and collect a few
 * before/after samples so the user can confirm before sharing.
 */
export function previewRedaction(
  events: LogEvent[],
  config: RedactionConfig,
  maxSamples = 8,
): { changed: number; samples: Array<{ before: string; after: string }> } {
  let changed = 0;
  const samples: Array<{ before: string; after: string }> = [];
  for (const e of events) {
    const after = redactString(e.title, config.rules);
    if (after !== e.title) {
      changed++;
      if (samples.length < maxSamples) samples.push({ before: e.title, after });
    }
  }
  return { changed, samples };
}
