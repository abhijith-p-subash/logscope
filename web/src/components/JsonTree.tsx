import { useState, createContext, useContext } from "react";

interface TreeCtx {
  copy: (text: string, label: string) => void;
  defaultDepth: number;
}

const TreeCtx = createContext<TreeCtx>({ copy: () => {}, defaultDepth: 2 });

function valueClass(v: unknown): string {
  if (typeof v === "string") return "js";
  if (typeof v === "number") return "jn";
  if (typeof v === "boolean") return "jb";
  return "ju";
}

function primitive(v: unknown): string {
  return typeof v === "string" ? JSON.stringify(v) : String(v);
}

function Node({ k, value, path, depth }: { k: string | null; value: unknown; path: string; depth: number }) {
  const { copy, defaultDepth } = useContext(TreeCtx);
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object";
  const [open, setOpen] = useState(depth < defaultDepth);

  const keyEl =
    k !== null ? (
      <span
        className="jk"
        style={{ cursor: "pointer" }}
        title={`Copy path: ${path}`}
        onClick={(e) => {
          e.stopPropagation();
          copy(path, "path");
        }}
      >
        {JSON.stringify(k)}:
      </span>
    ) : null;

  if (!isObject) {
    return (
      <div style={{ paddingLeft: depth * 14 }}>
        {keyEl}
        {keyEl && " "}
        <span
          className={valueClass(value)}
          style={{ cursor: "pointer" }}
          title="Copy value"
          onClick={() => copy(primitive(value), "value")}
        >
          {primitive(value)}
        </span>
      </div>
    );
  }

  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const open2 = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";
  const count = entries.length;

  return (
    <div style={{ paddingLeft: depth * 14 }}>
      <span className="jtoggle" onClick={() => setOpen((o) => !o)}>
        <span className="ju">{open ? "▾ " : "▸ "}</span>
        {keyEl}
        {keyEl && " "}
        <span className="ju">
          {open2}
          {!open && (
            <span style={{ opacity: 0.55 }}>
              {count} {isArray ? (count === 1 ? "item" : "items") : count === 1 ? "key" : "keys"}
            </span>
          )}
          {!open && close}
        </span>
      </span>
      {open && (
        <>
          {entries.map(([ck, cv]) => (
            <Node
              key={ck}
              k={isArray ? null : ck}
              value={cv}
              path={isArray ? `${path}[${ck}]` : path ? `${path}.${ck}` : ck}
              depth={depth + 1}
            />
          ))}
          <div style={{ paddingLeft: (depth + 1) * 14 }}>
            <span className="ju">{close}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function JsonTree({
  value,
  copy,
  defaultDepth = 2,
}: {
  value: unknown;
  copy: (text: string, label: string) => void;
  defaultDepth?: number;
}) {
  return (
    <TreeCtx.Provider value={{ copy, defaultDepth }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.65 }}>
        <Node k={null} value={value} path="" depth={0} />
      </div>
    </TreeCtx.Provider>
  );
}
