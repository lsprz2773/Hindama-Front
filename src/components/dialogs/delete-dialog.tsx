"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ReactNode } from "react";
import { Modal, ModalActions } from "@/components/ui/modal";
import { inputClass } from "@/components/ui/text-field";
import { useSubmit, type SubmitError } from "./use-submit";

export interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Texto que la persona debe escribir para confirmar (nombre del proyecto o correo de la cuenta). */
  confirmText: string;
  /** «Se borra»: qué se elimina junto con el recurso. */
  consequences?: { heading: string; items: string[] };
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  mapError?: (error: unknown) => SubmitError;
}

/** C-07. Baja con texto a teclear (RF-14, RF-88): el botón se habilita solo si coincide exactamente. */
export function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  consequences,
  confirmLabel,
  onConfirm,
  mapError,
}: DeleteDialogProps) {
  const t = useTranslations("Dialogs");
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, error, submit, reset } = useSubmit(onConfirm, () => onOpenChange(false), mapError, {
    title: t("genericError"),
    text: t("genericErrorText"),
  });
  const matches = typed === confirmText;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setTyped("");
        }
        onOpenChange(next);
      }}
      title={title}
      description={description}
      tone="danger"
      icon="alert"
      alert
      initialFocus={inputRef}
      busy={busy}
      error={error}
      footer={
        <ModalActions
          cancelLabel={t("cancel")}
          onCancel={() => onOpenChange(false)}
          actionLabel={error ? t("retry") : confirmLabel}
          onAction={submit}
          danger
          busy={busy}
          disabled={!matches}
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
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold">
          {t.rich("typeToConfirm", {
            text: confirmText,
            code: (chunks) => <span className="font-mono text-[13px]">{chunks}</span>,
          })}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          autoComplete="off"
          placeholder={confirmText}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          className={inputClass}
        />
      </div>
    </Modal>
  );
}
