import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

const BAR_COLOR: Record<Severity, string> = {
  critical: "bg-sev-1",
  high: "bg-sev-2",
  medium: "bg-sev-3",
  low: "bg-sev-4",
  info: "bg-sev-5",
};

/** Medidor de cinco barras: crítica llena las cinco, informativa solo una. */
export function SeverityMeter({
  severity,
  className,
  barClassName,
}: {
  severity: Severity;
  className?: string;
  barClassName?: string;
}) {
  const filled = 5 - SEVERITIES.indexOf(severity);
  return (
    <span aria-hidden="true" className={cn("flex gap-[3px]", className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 60}ms` }}
          className={cn(
            "animate-grow-x h-2 w-5 origin-left rounded-sm",
            i < filled ? BAR_COLOR[severity] : "bg-track",
            barClassName,
          )}
        />
      ))}
    </span>
  );
}

/** C-04. Insignia de severidad: el medidor nunca va sin texto (contraste AA). */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const t = useTranslations("Severity");
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <SeverityMeter severity={severity} />
      <b className="text-[13px]">{t(severity)}</b>
    </span>
  );
}
