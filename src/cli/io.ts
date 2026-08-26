/**
 * File reading for the CLI. All Node filesystem access lives here (and in
 * `server/`), never in `core/`.
 *
 * Read-only: logscope never modifies, moves, or deletes anything in the target
 * (CLAUDE.md constraint 4).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { FileInput } from "../core/index.ts";

/** Extensions logscope will read. Matches the reference prototype. */
export const SUPPORTED = /\.(json|ndjson|csv|txt|log)$/i;

/**
 * Collect file inputs from a path. If it is a directory, reads every supported
 * file one level deep (sorted by name for stable output); if it is a file,
 * reads just that file. Throws a friendly Error on missing paths or empty dirs.
 */
export function collectInputs(target: string): FileInput[] {
  let st;
  try {
    st = statSync(target);
  } catch {
    throw new Error(`Path not found: ${target}`);
  }

  const paths: string[] = [];
  if (st.isDirectory()) {
    for (const name of readdirSync(target).sort()) {
      if (SUPPORTED.test(name)) paths.push(join(target, name));
    }
    if (!paths.length) {
      throw new Error(`No supported log files (.json .ndjson .csv .txt .log) in ${target}`);
    }
  } else {
    paths.push(target);
  }

  return paths.map(readInput);
}

function readInput(path: string): FileInput {
  // Read as a Buffer so size and hash come straight from the bytes — no second
  // full-string re-encode via Buffer.byteLength.
  const buf = readFileSync(path);
  return {
    name: basename(path),
    text: buf.toString("utf8"),
    size: buf.length,
    hash: createHash("sha256").update(buf).digest("hex").slice(0, 16),
  };
}
