import { useEffect } from "react";

const GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: "Navigation",
    items: [
      ["j  /  ↓", "Next event"],
      ["k  /  ↑", "Previous event"],
      ["g", "Jump to top"],
      ["G", "Jump to bottom"],
      ["e", "Expand selected event's detail"],
      ["Esc", "Close detail / clear focus"],
    ],
  },
  {
    title: "Search",
    items: [
      ["/", "Focus the search box"],
      ["word word", "Match all terms (AND)"],
      ["\"exact phrase\"", "Literal phrase"],
      ["-term", "Exclude a term"],
      ["a | b", "Either term (OR)"],
      ["/regex/", "Regular expression"],
      ["field:value", "Scope to a field or JSON key"],
    ],
  },
  {
    title: "General",
    items: [
      ["?", "Toggle this help"],
      ["Drag ribbon", "Filter by time range"],
      ["Click timestamp", "Expand a row inline"],
    ],
  },
];

/** Keyboard-shortcut + search-syntax reference overlay (opened with `?`). */
export function Shortcuts({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", kd);
    return () => document.removeEventListener("keydown", kd);
  }, [onClose]);

  return (
    <div className="sc-backdrop" onClick={onClose}>
      <div className="sc-modal" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="sc-hd">
          <span>Keyboard shortcuts &amp; search syntax</span>
          <button className="ibtn" title="Close (Esc)" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="sc-grid">
          {GROUPS.map((g) => (
            <div key={g.title} className="sc-group">
              <div className="sc-group-title">{g.title}</div>
              {g.items.map(([key, desc]) => (
                <div key={key} className="sc-row">
                  <kbd className="sc-key">{key}</kbd>
                  <span className="sc-desc">{desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sc-ft">Press <kbd className="sc-key">?</kbd> or <kbd className="sc-key">Esc</kbd> to close</div>
      </div>
    </div>
  );
}
