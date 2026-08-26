/**
 * Generate a 100k-row NDJSON export for performance testing.
 *
 * Output is gitignored (see .gitignore). Regenerate with:
 *   npm run gen:fixtures
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const N = 100_000;
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "testdata", "perf-100k.ndjson");

const levels = ["info", "info", "info", "debug", "warn", "error"];
const base = Date.parse("2026-08-21T00:00:00.000Z");

const lines: string[] = [];
for (let i = 0; i < N; i++) {
  const rid = "req-" + String(i % 500).padStart(4, "0");
  const level = levels[i % levels.length];
  const t = new Date(base + i * 37).toISOString();
  lines.push(
    JSON.stringify({
      timestamp: t,
      level,
      requestId: rid,
      message:
        level === "error"
          ? `operation failed with code ${1000 + (i % 50)} after ${i % 9000}ms`
          : `step ${i % 20} completed for user ${100000 + (i % 3000)}`,
    }),
  );
}

writeFileSync(out, lines.join("\n") + "\n");
console.log(`Wrote ${N.toLocaleString()} rows to ${out}`);
