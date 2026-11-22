"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export type ToastType = "success" | "error" | "warning" | "info" | "progress";

export interface ToastOptions {
  type?: ToastType;
  title: string;
  text?: string;
  /** Acción opcional («Reintentar», «Deshacer», «Ver»). */
  action?: { label: string; onClick: () => void };
  /** Milisegundos hasta cerrarse solo; `0` lo deja fijo. Por defecto depende del tipo. */
  duration?: number;
  /** Porcentaje 0-100 para el tipo `progress`. */
  progress?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  type: ToastType;
  /** Está haciendo su animación de salida y se quita al terminar. */
  closing?: boolean;
}

const EXIT_MS = 200;

interface ToastApi {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const MAX_VISIBLE = 3;

/** Cierre automático: 5 s; 8 s los avisos; los errores con acción y el progreso no se cierran solos. */
export function defaultDuration(options: Pick<ToastOptions, "type" | "action">): number {
  const type = options.type ?? "info";
  if (type === "progress") return 0;
  if (type === "error") return options.action ? 0 : 8000;
  if (type === "warning") return 8000;
  return 5000;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Toast");
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    // Sale con animación: primero se marca y, al terminar, se quita de la lista.
    setItems((current) => current.map((i) => (i.id === id ? { ...i, closing: true } : i)));
    window.setTimeout(() => setItems((current) => current.filter((i) => i.id !== id)), EXIT_MS);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const item: ToastItem = { ...options, type: options.type ?? "info", id };
    // Máximo 3 apilados: el más antiguo cede su sitio.
    setItems((current) => [...current, item].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-label={t("notifications")}
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6"
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TYPE_STYLE: Record<ToastType, { box: string; icon: IconName | null }> = {
  success: { box: "bg-success-bg text-success", icon: "check" },
  error: { box: "bg-danger-bg text-danger", icon: "xCircle" },
  warning: { box: "bg-warning-bg text-warning", icon: "alert" },
  info: { box: "bg-info-bg text-info", icon: "info" },
  progress: { box: "bg-progress-bg text-progress", icon: null },
};

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const t = useTranslations("Toast");
  const duration = item.duration ?? defaultDuration(item);
  const [paused, setPaused] = useState(false);
  const style = TYPE_STYLE[item.type];
  const isError = item.type === "error";

  // Cuenta atrás con pausa al pasar el cursor o enfocar.
  const remaining = useRef(duration);
  useEffect(() => {
    if (duration <= 0 || paused || item.closing) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [duration, paused, item.id, item.closing, onDismiss]);

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        item.closing ? "animate-toast-out" : "animate-toast-in",
        "border-line-strong bg-toast text-fg pointer-events-auto relative flex w-full max-w-[400px] items-start gap-3 overflow-hidden rounded-[20px] border py-3.5 pr-3.5 pl-4 shadow-[0_16px_40px_rgba(0,0,0,0.30)] backdrop-blur-xl",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-9 flex-none items-center justify-center rounded-xl",
          style.box,
        )}
      >
        {style.icon ? (
          <Icon name={style.icon} size={20} strokeWidth={2.4} />
        ) : (
          <Icon name="spinner" size={20} strokeWidth={2.4} className="animate-spin" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-px">
        <span className="text-[14.5px] leading-[1.3] font-bold">{item.title}</span>
        {item.text ? (
          <span className="text-muted text-[13.5px] leading-[1.45]">{item.text}</span>
        ) : null}
        {item.type === "progress" && item.progress !== undefined ? (
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={item.progress}
            aria-label={t("progress")}
            className="bg-track mt-2 block h-1.5 overflow-hidden rounded-[3px]"
          >
            <span
              className="bg-accent block h-full rounded-[3px]"
              style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
            />
          </span>
        ) : null}
        {item.action ? (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss(item.id);
            }}
            className="text-link mt-1.5 -ml-3 min-h-9 cursor-pointer self-start rounded-xl px-3 text-[13.5px] font-bold"
          >
            {item.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={t("close")}
        className="text-muted -mt-1 -mr-1 inline-flex size-9 flex-none cursor-pointer items-center justify-center rounded-xl"
      >
        <Icon name="x" size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
}
