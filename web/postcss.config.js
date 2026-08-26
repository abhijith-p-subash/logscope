import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Point Tailwind at web/tailwind.config.js explicitly: its plugin otherwise
// searches from the CWD (repo root), where there is no config.
export default {
  plugins: {
    tailwindcss: { config: join(here, "tailwind.config.js") },
    autoprefixer: {},
  },
};
