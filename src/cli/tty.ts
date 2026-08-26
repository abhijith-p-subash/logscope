/** Minimal ANSI colour helpers. No-ops when output is not a TTY or NO_COLOR is set. */
const enabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const wrap =
  (code: string) =>
  (s: string): string =>
    enabled ? `\x1b[${code}m${s}\x1b[0m` : s;

export const c = {
  dim: wrap("2"),
  bold: wrap("1"),
  red: wrap("31"),
  yellow: wrap("33"),
  green: wrap("32"),
  cyan: wrap("36"),
  violet: wrap("35"),
};
