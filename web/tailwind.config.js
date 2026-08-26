import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Forward-slashed absolute base so globs resolve regardless of CWD and work on
// Windows (fast-glob treats backslashes as escapes, not separators).
const here = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, "/");

/** @type {import('tailwindcss').Config} */
export default {
  content: [`${here}/index.html`, `${here}/src/**/*.{ts,tsx}`],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        panel2: "var(--panel2)",
        panel3: "var(--panel3)",
        line: "var(--line)",
        line2: "var(--line2)",
        fg: "var(--fg)",
        dim: "var(--dim)",
        faint: "var(--faint)",
        cyan: "var(--cyan)",
        amber: "var(--amber)",
        rose: "var(--rose)",
        green: "var(--green)",
        violet: "var(--violet)",
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "ui-monospace", "Menlo", "Consolas", "monospace"],
        sans: ["IBM Plex Sans", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
