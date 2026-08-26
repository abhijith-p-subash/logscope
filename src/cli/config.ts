/**
 * Optional user config at ~/.logscope.json. All fields are optional; a missing
 * or malformed file yields empty defaults (never throws).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface UserConfig {
  port?: number;
  /** Default folder to watch. */
  dir?: string;
  /** Whether to auto-open the browser on `serve`. */
  open?: boolean;
}

export function loadConfig(): UserConfig {
  try {
    const raw = readFileSync(join(homedir(), ".logscope.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as UserConfig) : {};
  } catch {
    return {};
  }
}
