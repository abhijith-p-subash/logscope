import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "./http.ts";
import { Store } from "./store.ts";
import { startWatcher, type Watcher } from "./watch.ts";

const NDJSON = '{"timestamp":"2026-08-21T00:00:00.000Z","level":"error","requestId":"r1","message":"boom"}';

describe("server + watcher integration", () => {
  let tmp: string;
  let store: Store;
  let server: ReturnType<typeof createServer>;
  let watcher: Watcher;
  let base: string;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), "logscope-srv-"));
    store = new Store();
    server = createServer(store);
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
    const port = (server.address() as AddressInfo).port;
    base = `http://127.0.0.1:${port}`;
    watcher = startWatcher(tmp, store, { stabilityThreshold: 50 });
  });

  afterAll(async () => {
    await watcher.close();
    await new Promise<void>((res) => server.close(() => res()));
    rmSync(tmp, { recursive: true, force: true });
  });

  it("binds loopback only", () => {
    expect((server.address() as AddressInfo).address).toBe("127.0.0.1");
  });

  it("picks up a file dropped into the watched folder and updates the store", async () => {
    const changed = new Promise<void>((res) => {
      const unsub = store.subscribe((c) => {
        if (c.kind === "add" && c.file === "drop.ndjson") {
          unsub();
          res();
        }
      });
    });
    writeFileSync(join(tmp, "drop.ndjson"), NDJSON);
    await withTimeout(changed, 8000, "watcher never reported the dropped file");

    expect(store.summary().events).toBe(1);
    expect(store.summary().errors).toBe(1);
  });

  it("serves the summary and full session over the JSON API", async () => {
    const summary = (await (await fetch(`${base}/api/summary`)).json()) as {
      events: number;
      files: Array<{ name: string }>;
    };
    expect(summary.events).toBe(1);
    expect(summary.files.map((f) => f.name)).toContain("drop.ndjson");

    const session = (await (await fetch(`${base}/api/session`)).json()) as {
      events: unknown[];
      traces: Array<{ rid: string }>;
    };
    expect(session.events).toHaveLength(1);
    expect(session.traces[0]!.rid).toBe("r1");
  });

  it("streams an initial summary over SSE", async () => {
    const resp = await fetch(`${base}/api/stream`);
    const reader = resp.body!.getReader();
    try {
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain("event: summary");
      expect(text).toContain('"events":1');
    } finally {
      await reader.cancel();
    }
  });

  it("serves the self-contained placeholder page with no external resources", async () => {
    const html = await (await fetch(`${base}/`)).text();
    expect(html).toContain("log");
    // Zero network egress: no CDN fonts/scripts/assets.
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("rejects non-GET methods", async () => {
    const resp = await fetch(`${base}/api/summary`, { method: "POST" });
    expect(resp.status).toBe(405);
  });
});

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms)),
  ]);
}
