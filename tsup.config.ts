import { defineConfig } from "tsup";

/**
 * Compile the CLI (and the core/server it bundles) to dist/cli. The two runtime
 * dependencies are kept external — they resolve from node_modules at runtime,
 * so the published dependency tree stays short and auditable.
 */
export default defineConfig({
  entry: { index: "src/cli/index.ts" },
  outDir: "dist/cli",
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  minify: false,
  external: ["commander", "chokidar"],
});
