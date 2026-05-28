import { CheckCircle2, Info, X, AlertCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "info" | "error";

type Toast = {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
};

type ToastContextValue = {
  show: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4000;

const VARIANT_STYLES: Record<ToastVariant, { ring: string; icon: ReactNode }> = {
  success: {
    ring: "border-status-offer/40 bg-status-offer/5",
    icon: <CheckCircle2 className="h-4 w-4 text-status-offer" />,
  },
  info: {
    ring: "border-accent/40 bg-accent/5",
    icon: <Info className="h-4 w-4 text-accent" />,
  },
  error: {
    ring: "border-status-rejected/40 bg-status-rejected/5",
    icon: <AlertCircle className="h-4 w-4 text-status-rejected" />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextValue["show"]>(
    (toast) => {
      const id = nextId.current++;
      setToasts((cur) => [...cur, { id, ...toast }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const styles = VARIANT_STYLES[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto glass rounded-lg border px-3 py-2.5 shadow-elevated flex items-start gap-2.5 animate-slide-up ${styles.ring}`}
            >
              <span className="mt-0.5 shrink-0">{styles.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink-primary">{t.title}</div>
                {t.description && (
                  <div className="text-xs text-ink-secondary mt-0.5">{t.description}</div>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-ink-muted hover:text-ink-primary p-0.5 rounded transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
