/**
 * HTTP server: static UI + JSON API + SSE. Uses `node:http` only — the routing
 * needs are trivial and a web framework would cost security-review time
 * (CLAUDE.md). Always bound to 127.0.0.1 by the caller; never 0.0.0.0.
 *
 * Endpoints:
 *   GET /api/summary   lightweight counts + file list
 *   GET /api/session   full session (events, traces, signatures, diagnostics)
 *   GET /api/stream    SSE: an initial summary, then one message per change
 *   GET /*             static files from the web build, or a placeholder page
 */
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { Store } from "./store.ts";

export interface ServerOptions {
  /** Directory of the built web UI (dist/web). Falls back to a placeholder. */
  webRoot?: string;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

/** Static config resolved once at startup rather than per request. */
interface StaticConfig {
  /** Resolved, existing web-build root, or null when there is no build. */
  root: string | null;
}

export function createServer(store: Store, opts: ServerOptions = {}): Server {
  const resolved = opts.webRoot ? resolve(opts.webRoot) : null;
  const staticCfg: StaticConfig = { root: resolved && existsSync(resolved) ? resolved : null };

  return createHttpServer((req, res) => {
    handle(req, res, store, staticCfg).catch((e) => {
      // A handler error must never crash the process.
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("internal error: " + (e as Error).message);
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  store: Store,
  staticCfg: StaticConfig,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;

  // Drag-drop / file-picker upload: ingest content in memory only — never
  // written to disk (DECISIONS.md D4).
  if (req.method === "POST" && path === "/api/files") {
    await uploadFile(req, res, store);
    return;
  }

  // Remove a file from the in-memory session by name.
  if (req.method === "DELETE" && path.startsWith("/api/files/")) {
    const name = decodeURIComponent(path.slice("/api/files/".length));
    store.remove(name);
    sendJSON(res, { ok: true });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain" });
    res.end("method not allowed");
    return;
  }

  if (path === "/api/summary") {
    sendJSON(res, store.summary());
    return;
  }

  if (path === "/api/session") {
    // Serve the memoized serialized session — avoids re-stringifying a large
    // payload on every fetch (the string is invalidated on the next change).
    if (req.method === "HEAD") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end();
      return;
    }
    sendRawJSON(res, store.getSessionJSON());
    return;
  }

  if (path === "/api/stream") {
    streamSSE(req, res, store);
    return;
  }

  if (path === "/favicon.ico") {
    res.writeHead(204).end();
    return;
  }

  await serveStatic(path, res, staticCfg);
}

const MAX_UPLOAD = 256 * 1024 * 1024; // 256 MB guard

/** Read a JSON `{ name, text }` body and ingest it into the store. */
async function uploadFile(req: IncomingMessage, res: ServerResponse, store: Store): Promise<void> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_UPLOAD) {
      res.writeHead(413, { "content-type": "text/plain" });
      res.end("file too large");
      req.destroy();
      return;
    }
    chunks.push(chunk as Buffer);
  }
  let name: unknown;
  let text: unknown;
  try {
    const body = Buffer.concat(chunks).toString("utf8");
    chunks.length = 0; // release the raw chunks before parsing/ingesting
    ({ name, text } = JSON.parse(body));
  } catch {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("invalid JSON body");
    return;
  }
  if (typeof name !== "string" || typeof text !== "string") {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("expected { name, text }");
    return;
  }
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  const result = store.addOrUpdate({ name, text, size: Buffer.byteLength(text), hash });
  sendJSON(res, { result, summary: store.summary() });
}

function sendJSON(res: ServerResponse, data: unknown): void {
  sendRawJSON(res, JSON.stringify(data));
}

/** Send an already-serialized JSON string (avoids a redundant stringify pass). */
function sendRawJSON(res: ServerResponse, body: string): void {
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

/** Server-Sent Events: push an initial summary, then one per store change. */
function streamSSE(req: IncomingMessage, res: ServerResponse, store: Store): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
  });

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send("summary", store.summary());
  const unsubscribe = store.subscribe((change) => send("change", change));

  // Heartbeat comment keeps intermediaries from closing an idle connection.
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

async function serveStatic(path: string, res: ServerResponse, cfg: StaticConfig): Promise<void> {
  const root = cfg.root;
  if (root) {
    const rel = path === "/" ? "index.html" : path.replace(/^\/+/, "");
    const target = resolve(join(root, normalize(rel)));

    // Path-traversal guard: the resolved target must stay inside webRoot.
    if (target === root || target.startsWith(root + sep)) {
      try {
        const body = await readFile(target);
        // Vite emits content-hashed filenames under /assets, so they can be
        // cached forever. Everything else (index.html) must not be cached.
        const immutable = path.startsWith("/assets/");
        res.writeHead(200, {
          "content-type": MIME[extname(target)] ?? "application/octet-stream",
          "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
        });
        res.end(body);
        return;
      } catch {
        // Not a file → fall through to the SPA index below.
      }
    }
    // Unknown path under a real SPA build → serve index.html (client routing).
    try {
      const body = await readFile(join(root, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      res.end(body);
      return;
    } catch {
      // No index.html → placeholder below.
    }
  }

  // No web build yet (Phase 3): serve the built-in placeholder.
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(PLACEHOLDER);
}

/**
 * Minimal, fully self-contained status page. No external fonts, scripts, or
 * assets — the app must work with the network disabled (constraint 1). It shows
 * the live summary via SSE so Phase 3 can be tested by dropping files in.
 */
const PLACEHOLDER = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>logscope</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#14171C; color:#DCE2EA;
    font:14px/1.5 ui-monospace,Menlo,Consolas,monospace; padding:32px; }
  h1 { font-size:18px; margin:0 0 4px; } h1 em { color:#52C7D8; font-style:normal; }
  .sub { color:#8894A3; margin-bottom:24px; }
  .stats { display:flex; gap:24px; margin-bottom:24px; flex-wrap:wrap; }
  .stat b { display:block; font-size:24px; } .stat span { color:#8894A3; font-size:12px; }
  .err b { color:#E4676F; }
  table { border-collapse:collapse; width:100%; max-width:720px; }
  th,td { text-align:left; padding:6px 10px; border-bottom:1px solid #2C333D; font-size:13px; }
  th { color:#5B6673; font-weight:400; text-transform:uppercase; font-size:11px; letter-spacing:.08em; }
  .warn { color:#E2A33E; margin-top:20px; } .dim { color:#5B6673; }
  a { color:#52C7D8; }
</style></head>
<body>
  <h1>▚ log<em>scope</em></h1>
  <div class="sub">Phase 3 status page · watching for files · <span id="conn" class="dim">connecting…</span></div>
  <div class="stats">
    <div class="stat"><b id="s-events">0</b><span>events</span></div>
    <div class="stat"><b id="s-traces">0</b><span>traces</span></div>
    <div class="stat err"><b id="s-errors">0</b><span>errors</span></div>
    <div class="stat"><b id="s-files">0</b><span>files</span></div>
  </div>
  <table><thead><tr><th>File</th><th>Events</th></tr></thead><tbody id="files">
    <tr><td class="dim" colspan="2">Drop a .json / .ndjson / .csv / .log file into the watched folder…</td></tr>
  </tbody></table>
  <div id="warnings" class="warn"></div>
  <div class="sub" style="margin-top:24px">
    API: <a href="/api/summary">/api/summary</a> · <a href="/api/session">/api/session</a>
  </div>
<script>
  function render(sum) {
    document.getElementById('s-events').textContent = sum.events.toLocaleString();
    document.getElementById('s-traces').textContent = sum.traces.toLocaleString();
    document.getElementById('s-errors').textContent = sum.errors.toLocaleString();
    document.getElementById('s-files').textContent = sum.files.length;
    var tb = document.getElementById('files');
    tb.innerHTML = sum.files.length
      ? sum.files.map(function(f){ return '<tr><td>'+esc(f.name)+'</td><td>'+f.count+'</td></tr>'; }).join('')
      : '<tr><td class="dim" colspan="2">No files yet…</td></tr>';
    document.getElementById('warnings').innerHTML =
      (sum.warnings||[]).map(function(w){ return '! '+esc(w); }).join('<br>');
  }
  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
  var es = new EventSource('/api/stream');
  var conn = document.getElementById('conn');
  es.addEventListener('summary', function(e){ conn.textContent='live'; conn.style.color='#7BB661'; render(JSON.parse(e.data)); });
  es.addEventListener('change', function(e){ render(JSON.parse(e.data).summary); });
  es.onerror = function(){ conn.textContent='disconnected'; conn.style.color='#E4676F'; };
</script>
</body></html>`;
