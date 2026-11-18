"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatCountdown, useCountdown } from "@/lib/use-countdown";
import { Button, ButtonLink } from "./button";
import { Icon, type IconName } from "./icon";

type Tone = "neutral" | "success" | "danger" | "warning";

const TONE: Record<Tone, string> = {
  neutral: "bg-info-bg text-info",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
};

export interface StateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  busy?: boolean;
  disabled?: boolean;
}

interface StateViewProps {
  icon: IconName;
  tone?: Tone;
  title: string;
  text?: string;
  /** Código de referencia para soporte (nunca detalles internos). */
  reference?: string;
  action?: StateAction;
  className?: string;
}

/** C-13. Estado de página o de lista: reemplaza solo el contenido y siempre ofrece una salida. */
export function StateView({
  icon,
  tone = "neutral",
  title,
  text,
  reference,
  action,
  className,
}: StateViewProps) {
  const t = useTranslations("States");
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}
    >
      <span
        aria-hidden="true"
        className={cn("inline-flex size-14 items-center justify-center rounded-[18px]", TONE[tone])}
      >
        <Icon name={icon} size={28} />
      </span>
      <b className="text-lg">{title}</b>
      {text ? (
        <span className="text-muted max-w-[48ch] text-[14.5px] leading-[1.5]">{text}</span>
      ) : null}
      {reference ? (
        <span className="text-muted font-mono text-[13px]">
          {t("reference", { id: reference })}
        </span>
      ) : null}
      {action ? (
        <div className="mt-2">
          {action.href ? (
            <ButtonLink href={action.href}>{action.label}</ButtonLink>
          ) : (
            <Button onClick={action.onClick} loading={action.busy} disabled={action.disabled}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Esqueleto de tabla o lista mientras carga. */
export function ListSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-label={label} role="status" className="flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="border-line bg-panel-2 flex animate-pulse items-center gap-4 rounded-[18px] border px-4 py-3.5"
        >
          <span className="bg-track size-10 flex-none rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <span className="bg-track h-3 w-2/5 rounded" />
            <span className="bg-track h-2.5 w-3/5 rounded" />
          </div>
          <span className="bg-track h-6 w-20 flex-none rounded-full" />
        </div>
      ))}
    </div>
  );
}

interface EmptyProps {
  title: string;
  text?: string;
  action?: StateAction;
  /** «Positivo»: no hay nada que atender (p. ej. sin hallazgos abiertos). */
  positive?: boolean;
}

export function EmptyState({ title, text, action, positive }: EmptyProps) {
  return (
    <StateView
      icon={positive ? "check" : "file"}
      tone={positive ? "success" : "neutral"}
      title={title}
      text={text}
      action={action}
    />
  );
}

export function NoResultsState({ onClear }: { onClear: () => void }) {
  const t = useTranslations("States");
  return (
    <StateView
      icon="list"
      title={t("noResults.title")}
      text={t("noResults.text")}
      action={{ label: t("noResults.action"), onClick: onClear }}
    />
  );
}

/** Error de carga: problema del servicio, con referencia y «Reintentar». */
export function LoadErrorState({
  subject,
  reference,
  onRetry,
  retrying,
}: {
  subject: string;
  reference?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const t = useTranslations("States");
  return (
    <StateView
      icon="alertCircle"
      tone="danger"
      title={t("loadError.title", { subject })}
      text={t("loadError.text")}
      reference={reference}
      action={{
        label: retrying ? t("retrying") : t("retry"),
        onClick: onRetry,
        busy: retrying,
      }}
    />
  );
}

export function ForbiddenState({ href }: { href: string }) {
  const t = useTranslations("States");
  return (
    <StateView
      icon="lock"
      tone="warning"
      title={t("forbidden.title")}
      text={t("forbidden.text")}
      action={{ label: t("forbidden.action"), href }}
    />
  );
}

/** 429: el reintento se habilita al terminar la espera (`Retry-After`). */
export function RateLimitedState({
  retryAfter,
  onRetry,
}: {
  retryAfter: number;
  onRetry: () => void;
}) {
  const t = useTranslations("States");
  const countdown = useCountdown(retryAfter);
  return (
    <StateView
      icon="clock"
      tone="warning"
      title={t("rateLimited.title")}
      text={t("rateLimited.text")}
      action={{
        label: countdown.done
          ? t("retry")
          : t("rateLimited.retryIn", { time: formatCountdown(countdown.remaining) }),
        onClick: onRetry,
        disabled: !countdown.done,
      }}
    />
  );
}

export function UnavailableState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("States");
  return (
    <StateView
      icon="alertCircle"
      tone="danger"
      title={t("unavailable.title")}
      text={t("unavailable.text")}
      action={{ label: t("retry"), onClick: onRetry }}
    />
  );
}

/** Acción bloqueada: nunca queda gris sin explicación; lleva el motivo y el enlace para resolverlo. */
export function BlockedAction({
  label,
  reason,
  linkLabel,
  href,
  className,
}: {
  label: string;
  reason: ReactNode;
  linkLabel: string;
  href: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3.5", className)}>
      <Button disabled>{label}</Button>
      <span className="text-muted flex items-start gap-2 text-sm">
        <Icon name="lock" size={16} className="mt-0.5" />
        <span>
          {reason}{" "}
          <ButtonLink
            href={href}
            variant="ghost"
            size="sm"
            className="inline min-h-0 px-0 text-sm font-bold underline"
          >
            {linkLabel}
          </ButtonLink>
        </span>
      </span>
    </div>
  );
}
