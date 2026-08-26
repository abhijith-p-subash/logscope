interface Props {
  rids: Array<[string, number]>;
  sigs: Array<[string, number]>;
  activeRid: string | null;
  activeSig: string | null;
  onPickRid: (rid: string) => void;
  onPickSig: (sig: string) => void;
  onClear: () => void;
  width: number;
}

export function Sidebar({ rids, sigs, activeRid, activeSig, onPickRid, onPickSig, onClear, width }: Props) {
  return (
    <aside className="side" style={{ width }}>
      <div className="sec">
        Requests
        <button className="btn sm" onClick={onClear}>
          All
        </button>
      </div>
      <div className="sidescroll">
        {rids.length === 0 ? (
          <div className="sitem" style={{ cursor: "default" }}>
            no request ids found
          </div>
        ) : (
          rids.map(([rid, n]) => (
            <button
              key={rid}
              className={"sitem" + (activeRid === rid ? " on" : "")}
              onClick={() => onPickRid(rid)}
            >
              <span className="dot" style={{ background: "var(--violet)" }} />
              <span className="nm">{rid.slice(0, 16)}</span>
              <span className="c">{n}</span>
            </button>
          ))
        )}
      </div>
      <div className="sec">Error signatures</div>
      <div className="sidescroll" style={{ maxHeight: "38%" }}>
        {sigs.length === 0 ? (
          <div className="sitem" style={{ cursor: "default" }}>
            no errors
          </div>
        ) : (
          sigs.map(([sig, n]) => (
            <button
              key={sig}
              className={"sitem" + (activeSig === sig ? " on" : "")}
              title={sig}
              onClick={() => onPickSig(sig)}
            >
              <span className="dot" style={{ background: "var(--rose)" }} />
              <span className="nm">{sig.slice(0, 26)}</span>
              <span className="c">{n}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
