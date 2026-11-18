"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "warning" | "error" | "info";

type Toast = {
  id: number;
  variant: ToastVariant;
  message: string;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4500;

/**
 * App-wide toast host. Mounted once in the root layout so any client component
 * can report the outcome of a server action without rendering a message next to
 * the button that triggered it.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  // Portals need document.body, which does not exist during SSR.
  const [mounted, setMounted] = React.useState(false);
  const nextId = React.useRef(0);

  React.useEffect(() => setMounted(true), []);

  const dismiss = React.useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, variant, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => toast(message, "success"),
      warning: (message: string) => toast(message, "warning"),
      error: (message: string) => toast(message, "error"),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="true"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[10000] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+80px)] sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-6 sm:items-end sm:pb-0"
          >
            {toasts.map((t) => (
              <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

const VARIANTS: Record<ToastVariant, { bg: string; border: string; fg: string; Icon: typeof Info }> = {
  success: { bg: "#E7F0E9", border: "#BED6C6", fg: "#2F6B4A", Icon: CheckCircle2 },
  warning: { bg: "#F4EAD3", border: "#DFCBA0", fg: "#8A6B2E", Icon: AlertTriangle },
  error: { bg: "#F6E4E1", border: "#E4BFB8", fg: "#9A3B2E", Icon: AlertTriangle },
  info: { bg: "#FFFDF9", border: "#EBE3D4", fg: "#3A352D", Icon: Info },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { bg, border, fg, Icon } = VARIANTS[toast.variant];
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-[14px] border px-4 py-3 shadow-[0_12px_32px_rgba(58,53,45,0.16)] animate-in fade-in-0 slide-in-from-bottom-2 sm:slide-in-from-top-2"
      style={{ background: bg, borderColor: border }}
    >
      <Icon className="mt-[1px] h-[18px] w-[18px] flex-none" style={{ color: fg }} />
      <p className="min-w-0 flex-1 break-words text-[14px] font-medium leading-snug" style={{ color: fg }}>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-my-1.5 -mr-1.5 flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors hover:bg-black/5"
        style={{ color: fg }}
      >
        <X className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}

/**
 * Access the toast API. Safe to call outside a provider (falls back to a no-op)
 * so isolated component tests do not need the provider wired up.
 */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (ctx) return ctx;
  const noop = () => {};
  return { toast: noop, success: noop, warning: noop, error: noop };
}
