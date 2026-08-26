import type { Toast } from "../state/useToast.ts";

const ICON: Record<Toast["variant"], string> = {
  info: "›",
  success: "✓",
  error: "✕",
};

/** Bottom-centered stack of transient toasts. */
export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={"toast toast-" + t.variant}>
          <span className="toast-ic">{ICON[t.variant]}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-x" title="Dismiss" aria-label="Dismiss notification" onClick={() => onDismiss(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
