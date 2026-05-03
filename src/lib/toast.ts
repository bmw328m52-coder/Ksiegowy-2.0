export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: number;
  message: string;
  kind: ToastKind;
  duration: number;
};

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(l: Listener): () => void {
  listeners.add(l);
  l(toasts);
  return () => {
    listeners.delete(l);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(message: string, kind: ToastKind, duration: number) {
  const id = nextId++;
  const t: Toast = { id, message, kind, duration };
  toasts = [...toasts, t];
  emit();
  if (duration > 0 && typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), duration);
  }
  return id;
}

export const toast = {
  success: (message: string, duration = 3500) => push(message, "success", duration),
  error: (message: string, duration = 5000) => push(message, "error", duration),
  info: (message: string, duration = 3000) => push(message, "info", duration),
};
