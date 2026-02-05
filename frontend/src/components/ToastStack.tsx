import { useEffect } from "react";

export type Toast = { id: string; message: string; kind?: "info" | "success" | "error" };

export default function ToastStack(props: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  ttlMs?: number;
}) {
  const ttlMs = props.ttlMs ?? 3200;

  useEffect(() => {
    if (props.toasts.length === 0) return;
    const timers = props.toasts.map((t) => setTimeout(() => props.onDismiss(t.id), ttlMs));
    return () => timers.forEach(clearTimeout);
  }, [props.toasts, props.onDismiss, ttlMs]);

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {props.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind ?? "info"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

