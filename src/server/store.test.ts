import { describe, expect, it, vi } from "vitest";
import type { FileInput } from "../core/index.ts";
import { Store } from "./store.ts";

const file = (name: string, text: string, hash: string): FileInput => ({
  name,
  text,
  size: text.length,
  hash,
});

const NDJSON = '{"timestamp":"2026-08-21T00:00:00.000Z","level":"error","requestId":"r1","message":"boom"}';

describe("Store", () => {
  it("adds a file and recomputes the session", () => {
    const s = new Store();
    expect(s.addOrUpdate(file("a.ndjson", NDJSON, "h1"))).toBe("added");
    const sum = s.summary();
    expect(sum.files).toHaveLength(1);
    expect(sum.events).toBe(1);
    expect(sum.errors).toBe(1);
  });

  it("dedupes identical content by hash (re-download is a no-op)", () => {
    const s = new Store();
    s.addOrUpdate(file("a.ndjson", NDJSON, "h1"));
    expect(s.addOrUpdate(file("a.ndjson", NDJSON, "h1"))).toBe("noop");
    expect(s.summary().files).toHaveLength(1);
  });

  it("updates when the same name has new content", () => {
    const s = new Store();
    s.addOrUpdate(file("a.ndjson", NDJSON, "h1"));
    // A second line with a *different* timestamp stays a distinct event.
    const line2 = '{"timestamp":"2026-08-21T00:00:05.000Z","level":"info","requestId":"r1","message":"ok"}';
    const two = NDJSON + "\n" + line2;
    expect(s.addOrUpdate(file("a.ndjson", two, "h2"))).toBe("updated");
    expect(s.summary().events).toBe(2);
  });

  it("removes a file", () => {
    const s = new Store();
    s.addOrUpdate(file("a.ndjson", NDJSON, "h1"));
    expect(s.remove("a.ndjson")).toBe(true);
    expect(s.remove("a.ndjson")).toBe(false);
    expect(s.summary().events).toBe(0);
  });

  it("notifies subscribers with change kind and summary", () => {
    const s = new Store();
    const listener = vi.fn();
    const unsub = s.subscribe(listener);

    s.addOrUpdate(file("a.ndjson", NDJSON, "h1"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0]).toMatchObject({ kind: "add", file: "a.ndjson" });

    s.addOrUpdate(file("a.ndjson", NDJSON, "h1")); // noop → no notification
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    s.remove("a.ndjson");
    expect(listener).toHaveBeenCalledTimes(1); // unsubscribed
  });

  it("isolates a throwing subscriber from ingestion", () => {
    const s = new Store();
    s.subscribe(() => {
      throw new Error("bad listener");
    });
    expect(() => s.addOrUpdate(file("a.ndjson", NDJSON, "h1"))).not.toThrow();
    expect(s.summary().events).toBe(1);
  });

  it("does not rebuild the session when re-adding unchanged content (S1)", () => {
    const s = new Store();
    s.addOrUpdate(file("a.ndjson", NDJSON, "h1"));
    const before = s.getSession();
    // Same hash → noop → recompute must not run, so the session object is reused.
    expect(s.addOrUpdate(file("a.ndjson", NDJSON, "h1"))).toBe("noop");
    expect(s.getSession()).toBe(before);
  });

  it("memoizes summary and serialized session until the next change (S3/S4)", () => {
    const s = new Store();
    s.addOrUpdate(file("a.ndjson", NDJSON, "h1"));
    expect(s.summary()).toBe(s.summary()); // same frozen object
    expect(s.getSessionJSON()).toBe(s.getSessionJSON());
    const json = s.getSessionJSON();
    s.remove("a.ndjson");
    expect(s.getSessionJSON()).not.toBe(json); // invalidated on change
  });

  it("coalesces a batch into a single recompute and broadcast (S2)", () => {
    const s = new Store();
    const listener = vi.fn();
    s.subscribe(listener);

    const line = (rid: string, ts: string) =>
      `{"timestamp":"${ts}","level":"info","requestId":"${rid}","message":"ok"}`;
    const results = s.addOrUpdateMany([
      file("a.ndjson", line("r1", "2026-08-21T00:00:00.000Z"), "ha"),
      file("b.ndjson", line("r2", "2026-08-21T00:00:01.000Z"), "hb"),
      file("c.ndjson", line("r3", "2026-08-21T00:00:02.000Z"), "hc"),
    ]);

    // Three files added, but only ONE broadcast.
    expect(listener).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.result)).toEqual(["added", "added", "added"]);
    expect(s.summary().events).toBe(3);
    expect(s.summary().files).toHaveLength(3);
  });

  it("emits nothing when a batch is entirely unchanged (S2)", () => {
    const s = new Store();
    s.addOrUpdate(file("a.ndjson", NDJSON, "h1"));
    const listener = vi.fn();
    s.subscribe(listener);
    const results = s.addOrUpdateMany([file("a.ndjson", NDJSON, "h1")]);
    expect(results).toEqual([{ name: "a.ndjson", result: "noop" }]);
    expect(listener).not.toHaveBeenCalled();
  });
});
