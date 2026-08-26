export type ViewMode = "log" | "waterfall" | "agent" | "diff" | "golden" | "concurrency";

const TABS: Array<{ id: ViewMode; label: string }> = [
  { id: "log", label: "Log" },
  { id: "waterfall", label: "Waterfall" },
  { id: "agent", label: "Agent tree" },
  { id: "diff", label: "Run diff" },
  { id: "golden", label: "Golden path" },
  { id: "concurrency", label: "Concurrency" },
];

export function ViewTabs({ mode, onMode }: { mode: ViewMode; onMode: (m: ViewMode) => void }) {
  return (
    <div className="viewtabs">
      {TABS.map((t) => (
        <button key={t.id} className={"vtab" + (mode === t.id ? " on" : "")} onClick={() => onMode(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
