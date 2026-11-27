"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Modal, ModalActions, type ModalTone } from "@/components/ui/modal";
import type { IconName } from "@/components/ui/icon";
import { useSubmit, type SubmitError } from "./use-submit";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Lista «Se perdería» / «Se borra» con lo que implica la acción. */
  consequences?: { heading: string; items: string[] };
  cancelLabel?: string;
  confirmLabel: string;
  /** Acción destructiva: botón rojo. */
  danger?: boolean;
  tone?: ModalTone;
  icon?: IconName;
  onConfirm: () => Promise<void>;
  /** Traduce el error de la acción al texto del modal. */
  mapError?: (error: unknown) => SubmitError;
}

/** C-06. Confirmación genérica para acciones de riesgo o destructivas. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  consequences,
  cancelLabel,
  confirmLabel,
  danger,
  tone,
  icon,
  onConfirm,
  mapError,
}: ConfirmDialogProps) {
  const t = useTranslations("Dialogs");
  const { busy, error, submit, reset } = useSubmit(onConfirm, () => onOpenChange(false), mapError, {
    title: t("genericError"),
    text: t("genericErrorText"),
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={title}
      description={description}
      tone={tone ?? (danger ? "danger" : "warning")}
      icon={icon ?? "alert"}
      busy={busy}
      error={error}
      footer={
        <ModalActions
          cancelLabel={cancelLabel ?? t("cancel")}
          onCancel={() => onOpenChange(false)}
          actionLabel={error ? t("retry") : confirmLabel}
          onAction={submit}
          danger={danger}
          busy={busy}
        />
      }
    >
      {consequences ? (
        <div className="border-line bg-panel-2 flex flex-col gap-2 rounded-[20px] border px-[18px] py-4">
          <b className="text-sm">{consequences.heading}</b>
          <ul className="text-muted m-0 flex list-disc flex-col gap-1 pl-[18px] text-[13.5px] leading-[1.45]">
            {consequences.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Modal>
  );
}
