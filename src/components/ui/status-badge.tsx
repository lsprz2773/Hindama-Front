import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type Tone = "ok" | "warning" | "danger" | "info" | "progress";

const TONES: Record<Tone, { bg: string; dot: string }> = {
  ok: { bg: "bg-success-bg", dot: "bg-success" },
  warning: { bg: "bg-warning-bg", dot: "bg-warning" },
  danger: { bg: "bg-danger-bg", dot: "bg-danger" },
  info: { bg: "bg-info-bg", dot: "bg-info" },
  progress: { bg: "bg-progress-bg", dot: "bg-accent" },
};

/** Estados por entidad y el tono con el que se pintan (C-05). */
export const STATUS_TONE = {
  project: {
    verified: "ok",
    pendingVerification: "warning",
    verificationLost: "danger",
    concluded: "info",
  },
  run: {
    queued: "info",
    running: "progress",
    completed: "ok",
    cancelled: "info",
    failed: "danger",
  },
  identity: { active: "ok", expiredCredential: "warning", untested: "info" },
  finding: {
    open: "danger",
    new: "progress",
    persistent: "info",
    regression: "danger",
    resolved: "ok",
    acceptedRisk: "info",
  },
} as const satisfies Record<string, Record<string, Tone>>;

export type StatusKind = keyof typeof STATUS_TONE;
export type StatusOf<K extends StatusKind> = keyof (typeof STATUS_TONE)[K] & string;

interface StatusBadgeProps<K extends StatusKind> {
  kind: K;
  status: StatusOf<K>;
  className?: string;
}

/**
 * C-05. Insignia de estado: punto de color más texto; el color solo refuerza.
 * Los estados de proyecto, ejecución, identidad y hallazgo comparten esta forma.
 */
export function StatusBadge<K extends StatusKind>({
  kind,
  status,
  className,
}: StatusBadgeProps<K>) {
  const t = useTranslations("Status");
  const tone = TONES[(STATUS_TONE[kind] as Record<string, Tone>)[status]];
  return (
    <span
      className={cn(
        "inline-flex min-h-[30px] items-center gap-2 rounded-full px-3 text-[13px] font-semibold",
        tone.bg,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", tone.dot)} />
      {t(`${kind}.${status}` as never)}
    </span>
  );
}
