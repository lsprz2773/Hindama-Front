import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

export type BannerTone = "warning" | "info" | "danger" | "success";

const TONE: Record<BannerTone, { border: string; chip: string; icon: IconName }> = {
  warning: { border: "border-l-warning", chip: "bg-warning-bg text-warning", icon: "alert" },
  info: { border: "border-l-info", chip: "bg-info-bg text-info", icon: "info" },
  danger: { border: "border-l-danger", chip: "bg-danger-bg text-danger", icon: "alertCircle" },
  success: { border: "border-l-success", chip: "bg-success-bg text-success", icon: "check" },
};

interface BannerProps {
  tone?: BannerTone;
  title: string;
  children?: ReactNode;
  /** Acción a la derecha («Cambiar URL», «Verificar»…). */
  action?: ReactNode;
  icon?: IconName;
  /** Texto de la etiqueta pequeña junto al título (p. ej. «Persistente»). */
  tag?: string;
  className?: string;
}

/** Banner persistente: se queda en la página mientras exista la causa (catálogo de estados). */
export function Banner({
  tone = "warning",
  title,
  children,
  action,
  icon,
  tag,
  className,
}: BannerProps) {
  const style = TONE[tone];
  return (
    <div
      role="status"
      className={cn(
        "border-line bg-panel-2 flex items-start gap-3.5 rounded-[20px] border border-l-4 px-[18px] py-4 backdrop-blur-lg",
        style.border,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-9 flex-none items-center justify-center rounded-xl",
          style.chip,
        )}
      >
        <Icon name={icon ?? style.icon} size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <b className="text-[15px]">{title}</b>
          {tag ? (
            <span className="bg-track rounded-full px-2.5 py-0.5 text-[11.5px] font-bold tracking-[0.03em]">
              {tag}
            </span>
          ) : null}
        </div>
        {children ? <div className="text-muted text-sm leading-[1.5]">{children}</div> : null}
      </div>
      {action ? <div className="flex-none self-center text-sm font-bold">{action}</div> : null}
    </div>
  );
}
