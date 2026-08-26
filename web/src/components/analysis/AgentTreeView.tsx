import { agentTree, type AgentNode, type Trace } from "@core/index.ts";

function ToolNode({ node }: { node: AgentNode }) {
  return (
    <div style={{ marginLeft: 18, marginTop: 4 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>
        <span style={{ color: "var(--cyan)" }}>⚙ {node.label}</span>
        {node.repeated && (
          <span
            style={{
              marginLeft: 8,
              color: "var(--amber)",
              border: "1px solid color-mix(in srgb, var(--amber) 40%, transparent)",
              borderRadius: 9,
              padding: "0 6px",
              fontSize: 9.5,
            }}
          >
            repeated call
          </span>
        )}
      </div>
      {node.events.map((e) => (
        <div
          key={e.id}
          style={{ marginLeft: 18, fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          title={e.title}
        >
          <span className={"lv " + e.level} style={{ fontSize: 9.5 }}>
            {e.level.toUpperCase()}
          </span>{" "}
          {e.title}
        </div>
      ))}
    </div>
  );
}

/** Nested iteration → tool → result tree for LLM-agent pipeline logs. */
export function AgentTreeView({ trace }: { trace: Trace }) {
  const tree = agentTree(trace.events);
  if (!tree) {
    return (
      <div className="empty">
        No agent markers ([ITER-n], [TOOL_CALL:…], [TOOL_RESULT:…]) in this request.
      </div>
    );
  }
  return (
    <div style={{ overflow: "auto", padding: "10px 14px", flex: 1 }}>
      {tree.map((iter, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--violet)", fontWeight: 600 }}>
            ▾ {iter.label}
          </div>
          {iter.children.length === 0 ? (
            <div style={{ marginLeft: 18, color: "var(--faint)", fontSize: 11 }}>no tool calls</div>
          ) : (
            iter.children.map((tool, j) => <ToolNode key={j} node={tool} />)
          )}
        </div>
      ))}
    </div>
  );
}
