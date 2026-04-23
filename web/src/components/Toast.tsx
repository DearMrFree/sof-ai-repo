"use client";

/**
 * Tiny toast system — one provider, one hook (`useToast`), no deps.
 *
 * Usage:
 *
 *   const toast = useToast();
 *   toast.push({ message: "Link copied", tone: "success" });
 *
 * Toasts auto-dismiss after ~3s. Safe to call from event handlers; toasts
 * from server components need to bubble up to a "use client" parent.
 *
 * Kept intentionally small (no queueing, no action buttons) because v1 only
 * needs ephemeral success/info confirmation. Swap for sonner when more
 * affordances are required.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "info" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastCtx {
  push: (t: Omit<Toast, "id">) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { ...t, id }]);
    // Auto-dismiss.
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <ToastViewport toasts={toasts} />
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fail soft: returning a no-op rather than throwing means callsites can
    // be rendered outside the provider (e.g. during SSR tests) without
    // crashing. Toasts just won't appear.
    return { push: () => {} };
  }
  return ctx;
}

function ToastViewport({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const styles: Record<ToastTone, { bg: string; border: string; Icon: typeof CheckCircle2 }> = {
    success: {
      bg: "bg-emerald-500/15",
      border: "border-emerald-500/30 text-emerald-100",
      Icon: CheckCircle2,
    },
    info: {
      bg: "bg-indigo-500/15",
      border: "border-indigo-500/30 text-indigo-100",
      Icon: Info,
    },
    error: {
      bg: "bg-rose-500/15",
      border: "border-rose-500/30 text-rose-100",
      Icon: XCircle,
    },
  };
  const s = styles[toast.tone];
  return (
    <div
      role="status"
      className={cn(
        "animate-sof-in pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2 text-sm shadow-xl shadow-black/40 backdrop-blur",
        s.bg,
        s.border,
      )}
    >
      <s.Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span className="leading-snug">{toast.message}</span>
    </div>
  );
}

export type { Toast };
