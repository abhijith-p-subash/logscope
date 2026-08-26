import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ingestFiles, type FileInput } from "../core/index.ts";
import { buildReport, runScan } from "./commands/scan.ts";

const testdata = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "testdata");
const read = (name: string): string => readFileSync(join(testdata, name), "utf8");

const inputs = (...names: string[]): FileInput[] =>
  names.map((name) => ({ name, text: read(name) }));

describe("buildReport", () => {
  it("summarizes files, traces, errors, and rejoins", () => {
    const session = ingestFiles(inputs("fragmented-pretty.json", "clean-json.json"));
    const r = buildReport(session);

    expect(r.summary.files).toBe(2);
    expect(r.summary.events).toBe(session.events.length);
    expect(r.summary.rejoined).toBeGreaterThan(0); // fragmented file rejoined rows
    expect(r.summary.errors).toBeGreaterThanOrEqual(2); // one error in each fixture

    const abc = r.traces.find((t) => t.rid === "req-abc-123");
    expect(abc).toBeDefined();
    expect(abc!.events).toBe(3);
    expect(abc!.errors).toBe(1);
  });

  it("reports the format and rejoin count per file", () => {
    const session = ingestFiles(inputs("fragmented-pretty.json"));
    const r = buildReport(session);
    const f = r.files[0]!;
    expect(f.format).toBe("json");
    expect(f.rejoined).toBe(8); // 9 fragment rows collapsed into 1 event
  });

  it("surfaces diagnostics warnings (empty file)", () => {
    const session = ingestFiles(inputs("empty.json"));
    const r = buildReport(session);
    expect(r.warnings.join(" ")).toMatch(/empty/i);
  });
});

describe("runScan — exit codes", () => {
  const tmp = mkdtempSync(join(tmpdir(), "logscope-scan-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  const silence = () => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    return () => {
      process.stdout.write = orig;
    };
  };

  it("returns 2 for a missing path", () => {
    const origErr = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      expect(runScan(join(testdata, "does-not-exist"), { json: true })).toBe(2);
    } finally {
      process.stderr.write = origErr;
    }
  });

  it("--json exits non-zero when errors are present (CI mode)", () => {
    const restore = silence();
    try {
      expect(runScan(join(testdata, "clean-json.json"), { json: true })).toBe(1);
    } finally {
      restore();
    }
  });

  it("--json exits zero when there are no errors", () => {
    const cleanFile = join(tmp, "all-info.ndjson");
    writeFileSync(
      cleanFile,
      [
        '{"timestamp":"2026-08-21T00:00:00.000Z","level":"info","requestId":"r1","message":"start ok"}',
        '{"timestamp":"2026-08-21T00:00:01.000Z","level":"info","requestId":"r1","message":"done ok"}',
      ].join("\n"),
    );
    const restore = silence();
    try {
      expect(runScan(cleanFile, { json: true })).toBe(0);
    } finally {
      restore();
    }
  });

  it("human mode exits zero even with errors present", () => {
    const restore = silence();
    try {
      expect(runScan(join(testdata, "clean-json.json"), {})).toBe(0);
    } finally {
      restore();
    }
  });
});
