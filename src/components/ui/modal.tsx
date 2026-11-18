"use client";

import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useRef, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Icon, type IconName } from "./icon";

export type ModalTone = "warning" | "danger" | "accent";

const TONE: Record<ModalTone, string> = {
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  accent: "bg-progress-bg text-progress",
};

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  icon?: IconName;
  tone?: ModalTone;
  /** Bloqueante: no se cierra con Esc ni fuera del cuadro y no muestra la X (p. ej. términos nuevos). */
  blocking?: boolean;
  /** Diálogo de alerta (acciones destructivas): se anuncia como `alertdialog`. */
  alert?: boolean;
  /** Elemento que recibe el foco al abrir (por defecto, el primero del diálogo). */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Mientras envía no se puede cerrar. */
  busy?: boolean;
  /** Error de la acción, dentro del modal (estado «error»). */
  error?: { title: string; text?: string };
  /** Estado «éxito»: reemplaza el contenido por una confirmación con un botón «Listo». */
  success?: { title: string; text: string; action: string };
  children?: ReactNode;
  /** Botones de acción; el primario va al final. */
  footer?: ReactNode;
  footnote?: ReactNode;
}

/** C-20. Contenedor único de diálogos: foco atrapado, Esc cierra salvo en los bloqueantes. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  icon = "alertCircle",
  tone = "warning",
  blocking = false,
  alert = false,
  initialFocus,
  busy = false,
  error,
  success,
  children,
  footer,
  footnote,
}: ModalProps) {
  const t = useTranslations("Modal");
  const locked = blocking || busy;
  // Al cerrar, el foco vuelve al control que abrió el modal (Radix solo lo hace con Trigger).
  const opener = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!locked || next) && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm" />
        <Dialog.Content
          role={alert ? "alertdialog" : "dialog"}
          onOpenAutoFocus={(e) => {
            opener.current = document.activeElement as HTMLElement | null;
            if (initialFocus?.current) {
              e.preventDefault();
              initialFocus.current.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            if (opener.current?.isConnected) {
              e.preventDefault();
              opener.current.focus();
            }
          }}
          onEscapeKeyDown={(e) => locked && e.preventDefault()}
          onPointerDownOutside={(e) => locked && e.preventDefault()}
          onInteractOutside={(e) => locked && e.preventDefault()}
          className="border-line-strong bg-menu text-fg fixed top-1/2 left-1/2 z-[91] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-[28px] border p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:p-8"
        >
          {success ? (
            <div role="status" className="flex flex-col items-start gap-3.5">
              <span
                aria-hidden="true"
                className="bg-success-bg text-success inline-flex size-[52px] items-center justify-center rounded-[18px]"
              >
                <Icon name="check" size={26} strokeWidth={2.4} />
              </span>
              <Dialog.Title className="font-display text-[26px] font-medium tracking-[-0.02em]">
                {success.title}
              </Dialog.Title>
              <Dialog.Description className="text-muted text-[14.5px] leading-[1.55]">
                {success.text}
              </Dialog.Description>
              <Dialog.Close asChild>
                <Button>{success.action}</Button>
              </Dialog.Close>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-12 flex-none items-center justify-center rounded-2xl",
                    TONE[tone],
                  )}
                >
                  <Icon name={icon} size={24} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Dialog.Title className="font-display text-[26px] leading-[1.15] font-medium tracking-[-0.02em]">
                    {title}
                  </Dialog.Title>
                  <Dialog.Description asChild>
                    <div className="text-muted text-[14.5px] leading-[1.55]">{description}</div>
                  </Dialog.Description>
                </div>
                {!blocking ? (
                  <Dialog.Close
                    disabled={busy}
                    aria-label={t("close")}
                    className="text-muted -mt-1.5 -mr-2 inline-flex size-10 flex-none cursor-pointer items-center justify-center rounded-[14px] disabled:cursor-not-allowed"
                  >
                    <Icon name="x" size={20} strokeWidth={2.2} />
                  </Dialog.Close>
                ) : null}
              </div>

              {error ? (
                <div
                  role="alert"
                  className="border-danger bg-danger-bg flex items-start gap-3 rounded-[18px] border px-4 py-3.5"
                >
                  <Icon
                    name="alertCircle"
                    size={20}
                    strokeWidth={2.2}
                    className="text-danger mt-px"
                  />
                  <div className="flex flex-col gap-0.5">
                    <b className="text-sm">{error.title}</b>
                    {error.text ? (
                      <span className="text-muted text-[13.5px] leading-[1.45]">{error.text}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {children}

              {footer ? (
                <div className="flex flex-wrap items-center justify-end gap-2.5">{footer}</div>
              ) : null}
              {footnote ? (
                <p className="text-muted -mt-1.5 text-right text-[12.5px] leading-[1.45]">
                  {footnote}
                </p>
              ) : null}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Pie estándar: cancelar (secundario) + acción principal. */
export function ModalActions({
  cancelLabel,
  onCancel,
  actionLabel,
  onAction,
  danger,
  busy,
  disabled,
}: {
  cancelLabel?: string;
  onCancel?: () => void;
  actionLabel: string;
  onAction: () => void;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      {cancelLabel ? (
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
      ) : null}
      <Button
        variant={danger ? "danger" : "primary"}
        onClick={onAction}
        loading={busy}
        disabled={disabled}
      >
        {actionLabel}
      </Button>
    </>
  );
}
