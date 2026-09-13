"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "neutral";
type Toast = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { notify: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3600);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite">{toasts.map((toast) => <div className={`toast toast--${toast.tone}`} key={toast.id}><span />{toast.message}<button aria-label="Закрыть уведомление" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>×</button></div>)}</div></ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
