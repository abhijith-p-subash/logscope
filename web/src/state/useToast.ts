import { useCallback, useRef, useState } from "react";

export type ToastVariant = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastApi {
  toasts: Toast[];
  toast: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

const LIFETIME = 3400;
const MAX = 4;

/** A small stack of transient toasts with success/error/info variants. */
export function useToast(): ToastApi {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const h = timers.current.get(id);
    if (h) { clearTimeout(h); timers.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, variant }].slice(-MAX));
    const h = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, LIFETIME);
    timers.current.set(id, h);
  }, []);

  return { toasts, toast, dismiss };
}
