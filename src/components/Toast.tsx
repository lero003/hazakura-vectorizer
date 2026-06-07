import { useEffect } from "react";
import type { ToastMessage } from "../lib/types";

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.kind === "error" || toast.kind === "warning") return;
    const id = window.setTimeout(() => onDismiss(toast.id), 4000);
    return () => window.clearTimeout(id);
  }, [toast.id, toast.kind, onDismiss]);

  return (
    <div className={`toast is-${toast.kind}`} role="status">
      <div className="toast-body">
        <div className="toast-text">{toast.text}</div>
        {toast.detail && <div className="toast-detail">{toast.detail}</div>}
      </div>
      <button
        className="button-ghost"
        style={{ alignSelf: "flex-start", padding: "0 4px" }}
        onClick={() => onDismiss(toast.id)}
        aria-label="dismiss"
      >
        ×
      </button>
    </div>
  );
}
