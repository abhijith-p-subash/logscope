import { formatTime, splitMillis, type TimeMode } from "../lib/format.ts";

/** Renders a timestamp with the millisecond fraction visually de-emphasized. */
export function TimeText({ t, tz, base }: { t: number; tz: TimeMode; base?: number }) {
  const [head, ms, tail] = splitMillis(formatTime(t, tz, base));
  return (
    <>
      {head}
      <u>{ms}</u>
      {tail}
    </>
  );
}
