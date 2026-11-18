"use client";

import { useTranslations } from "next-intl";
import { PublicShell } from "@/components/layout/public-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatCountdown, useCountdown } from "@/lib/use-countdown";

export type ErrorCode = 401 | 403 | 404 | 429 | 500 | 503;

interface ErrorPanelProps {
  code: ErrorCode;
  /** 500/503: vuelve a intentar la operación fallida. */
  onRetry?: () => void;
  /** 429: segundos de espera que indica `Retry-After`. */
  retryAfter?: number;
  /** 500: código de referencia para soporte (nunca detalles internos). */
  reference?: string;
  /** Destino del botón principal cuando la variante lleva a una ruta (por rol). */
  href?: string;
  /** Con `false` se muestra solo la tarjeta, sin el marco público (p. ej. dentro de un layout autenticado). */
  standalone?: boolean;
}

const DEFAULT_HREF: Record<ErrorCode, string | null> = {
  401: "/sign-in",
  403: "/admin",
  404: "/projects",
  429: null,
  500: null,
  503: null,
};

/** V-12. Páginas de error sin detalles internos; todas ofrecen una salida (RNF-13). */
export function ErrorPanel({
  code,
  onRetry,
  retryAfter = 30,
  reference,
  href,
  standalone = true,
}: ErrorPanelProps) {
  const t = useTranslations("Errors");
  const countdown = useCountdown(code === 429 ? retryAfter : 0);
  const target = href ?? DEFAULT_HREF[code];
  const waiting = code === 429 && !countdown.done;

  const card = (
    <section
      aria-labelledby="error-title"
      className={cn(
        "border-line flex flex-col gap-3.5 rounded-[28px] border p-8 backdrop-blur-lg sm:p-12",
        code === 404 ? "bg-[image:var(--hero)]" : "bg-panel",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "font-display text-[88px] leading-none font-medium tracking-[-0.05em]",
          code === 500 || code === 503 ? "text-danger" : "text-accent",
        )}
      >
        {code}
      </span>
      <h1
        id="error-title"
        className="font-display text-[26px] font-medium tracking-[-0.02em] sm:text-[32px]"
      >
        {t(`${code}.title`)}
      </h1>
      <p className="text-muted max-w-[56ch] text-[15px] leading-[1.55]">{t(`${code}.text`)}</p>
      {reference ? (
        <code className="text-muted font-mono text-[13px]">
          {t("reference", { id: reference })}
        </code>
      ) : null}
      {waiting ? (
        <p role="status" className="text-muted text-sm">
          {t("429.wait", { time: formatCountdown(countdown.remaining) })}
        </p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap gap-2.5">
        {target ? (
          <ButtonLink href={target}>{t(`${code}.action`)}</ButtonLink>
        ) : (
          <Button onClick={onRetry ?? (() => window.location.reload())} disabled={waiting}>
            {t(`${code}.action`)}
          </Button>
        )}
      </div>
    </section>
  );

  return standalone ? <PublicShell>{card}</PublicShell> : card;
}
