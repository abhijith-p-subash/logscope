import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));

// The web app is bundled to dist/web and served by our own node:http server.
// In dev, `/api/*` is proxied to a running `logscope serve` on 4477.
export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: {
      // Reuse the pure engine (types + formatters + search) in the browser.
      "@core": resolve(here, "..", "src", "core"),
    },
  },
  build: {
    outDir: resolve(here, "..", "dist", "web"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5473,
    proxy: {
      "/api": { target: "http://127.0.0.1:4477", changeOrigin: true },
    },
  },
});
