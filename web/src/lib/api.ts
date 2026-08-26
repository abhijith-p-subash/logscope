import type { Session } from "@core/index.ts";

export interface Summary {
  files: Array<{ name: string; count: number; on: boolean }>;
  events: number;
  traces: number;
  errors: number;
  warnings: string[];
}

/** Fetch the full assembled session from the server. */
export async function fetchSession(): Promise<Session> {
  const r = await fetch("/api/session");
  if (!r.ok) throw new Error(`GET /api/session → ${r.status}`);
  return (await r.json()) as Session;
}

export interface StreamHandlers {
  onOpen?: () => void;
  onSummary?: (s: Summary) => void;
  onChange?: () => void;
  onError?: () => void;
}

/** Subscribe to server-sent change events. Returns an unsubscribe function. */
export function openStream(h: StreamHandlers): () => void {
  const es = new EventSource("/api/stream");
  es.onopen = () => h.onOpen?.();
  es.addEventListener("summary", (e) => h.onSummary?.(JSON.parse((e as MessageEvent).data)));
  es.addEventListener("change", () => h.onChange?.());
  es.onerror = () => h.onError?.();
  return () => es.close();
}

/**
 * Upload a file's content for in-memory ingestion (drag-drop / file picker).
 * The server never writes it to disk — no persistence (DECISIONS.md D4).
 */
export async function uploadFile(name: string, text: string): Promise<void> {
  const r = await fetch("/api/files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, text }),
  });
  if (!r.ok) throw new Error(`POST /api/files → ${r.status}`);
}

/** Remove a file from the server's in-memory session by name. */
export async function deleteFile(name: string): Promise<void> {
  const r = await fetch(`/api/files/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`DELETE /api/files → ${r.status}`);
}
