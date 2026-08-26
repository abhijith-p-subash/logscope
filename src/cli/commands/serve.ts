/**
 * `logscope serve [dir]` (also the default command, aliased `watch`) — watch a
 * folder and serve the web UI + API. Binds 127.0.0.1 only: no auth is needed
 * because it is unreachable from the network (CLAUDE.md constraint 5).
 *
 * Passing `null` as the directory starts the UI with no watcher at all
 * (`logscope ui`): the session stays empty until files are dropped into the
 * window, which uploads them in memory via POST /api/files.
 */
import { spawn } from "node:child_process";
import type { Server } from "node:http";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../../server/http.ts";
import { Store } from "../../server/store.ts";
import { startWatcher } from "../../server/watch.ts";
import { c } from "../tty.ts";

export interface ServeOptions {
  port?: string;
  /** commander sets this to false when `--no-open` is passed. */
  open?: boolean;
}

/** Open the default browser at `url` using the OS launcher. No new dependency. */
function openBrowser(url: string): void {
  try {
    const platform = process.platform;
    const cmd = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
    const args = platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.unref();
  } catch {
    // Opening a browser is best-effort; the URL is printed regardless.
  }
}

const HOST = "127.0.0.1";
const MAX_PORT_TRIES = 10;

/** Locate the built web UI (dist/web), if it exists. */
function resolveWebRoot(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  // From src/cli/commands or dist/cli, dist/web sits at the package root.
  for (const candidate of [
    resolve(here, "..", "..", "..", "dist", "web"),
    resolve(here, "..", "..", "dist", "web"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Try to listen on `port`, incrementing on EADDRINUSE. Resolves the bound port. */
function listen(server: Server, port: number, tries = MAX_PORT_TRIES): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const attempt = (p: number, left: number): void => {
      const onError = (e: NodeJS.ErrnoException): void => {
        if (e.code === "EADDRINUSE" && left > 0) {
          attempt(p + 1, left - 1);
        } else {
          reject(e);
        }
      };
      server.once("error", onError);
      server.listen(p, HOST, () => {
        server.removeListener("error", onError);
        resolvePort(p);
      });
    };
    attempt(port, tries);
  });
}

export async function runServe(dir: string | null, opts: ServeOptions): Promise<void> {
  // dir === null → UI-only mode: serve the app, watch nothing.
  const target = dir === null ? null : resolve(dir);
  if (target !== null && !existsSync(target)) {
    process.stderr.write(`Path not found: ${target}\n`);
    process.exitCode = 2;
    return;
  }

  const requestedPort = Number(opts.port ?? 4477) || 4477;
  const store = new Store();
  const server = createServer(store, { webRoot: resolveWebRoot() });

  let port: number;
  try {
    port = await listen(server, requestedPort);
  } catch (e) {
    process.stderr.write(`Could not bind a port: ${(e as Error).message}\n`);
    process.exitCode = 2;
    return;
  }

  const url = `http://${HOST}:${port}`;
  const log = (msg: string): void => {
    process.stdout.write("  " + msg + "\n");
  };

  const watcher =
    target === null
      ? null
      : startWatcher(target, store, {
          onReady: () => {
            const s = store.summary();
            log(c.dim(`ready · ${s.files.length} files · ${s.events} events · ${s.traces} traces`));
          },
          onChange: (msg) => log(c.cyan("→ ") + msg),
          onError: (msg) => log(c.yellow("! ") + msg),
        });

  process.stdout.write("\n");
  log(`${c.bold("logscope")} serving ${c.cyan(url)}`);
  if (target === null) {
    log(c.dim("no folder watched"));
    log(c.dim("drop CloudWatch exports onto the window · Ctrl-C to stop"));
  } else {
    log(c.dim(`watching ${target}`));
    log(c.dim("drop CloudWatch exports into that folder · Ctrl-C to stop"));
  }
  process.stdout.write("\n");

  if (opts.open !== false) openBrowser(url);

  const shutdown = async (): Promise<void> => {
    process.stdout.write("\n");
    log(c.dim("shutting down…"));
    await watcher?.close();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
