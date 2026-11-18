"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Modal, ModalActions } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { useSubmit, type SubmitError } from "./use-submit";

export type RiskReason = "accepted" | "false_positive";
export const MIN_JUSTIFICATION = 10;
export const MAX_JUSTIFICATION = 500;

export interface AcceptRiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (decision: { reason: RiskReason; justification: string }) => Promise<void>;
  mapError?: (error: unknown) => SubmitError;
}

/**
 * C-09. Aceptar un riesgo o marcar un falso positivo (RF-70, RN-09). «Falso positivo» no es un
 * estado: es un motivo dentro de «Riesgo aceptado» (decisión del punto 6).
 */
export function AcceptRiskDialog({
  open,
  onOpenChange,
  onSubmit,
  mapError,
}: AcceptRiskDialogProps) {
  const t = useTranslations("AcceptRisk");
  const td = useTranslations("Dialogs");
  const areaId = useId();
  const [reason, setReason] = useState<RiskReason>("accepted");
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = text.trim();
  const invalid = trimmed.length < MIN_JUSTIFICATION;
  const showError = touched && invalid;

  const { busy, error, submit, reset } = useSubmit(
    () => onSubmit({ reason, justification: trimmed }),
    () => onOpenChange(false),
    mapError,
    { title: td("genericError"), text: td("genericErrorText") },
  );

  function handleSubmit() {
    setTouched(true);
    if (invalid) return;
    void submit();
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setText("");
          setTouched(false);
          setReason("accepted");
        }
        onOpenChange(next);
      }}
      title={t("title")}
      description={t("description")}
      tone="accent"
      icon="list"
      busy={busy}
      error={error}
      footer={
        <ModalActions
          cancelLabel={td("cancel")}
          onCancel={() => onOpenChange(false)}
          actionLabel={error ? td("retry") : t("submit")}
          onAction={handleSubmit}
          busy={busy}
        />
      }
    >
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">{t("reason")}</legend>
        {(["accepted", "false_positive"] as const).map((value) => {
          const selected = reason === value;
          return (
            <label
              key={value}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2 text-[14.5px]",
                selected ? "border-accent bg-selected font-semibold" : "border-line bg-panel-2",
              )}
            >
              <input
                type="radio"
                name="risk-reason"
                value={value}
                checked={selected}
                onChange={() => setReason(value)}
                disabled={busy}
                className="accent-accent size-[18px]"
              />
              <span className="flex flex-col">
                <b className="font-semibold">{t(`reasons.${value}`)}</b>
                <span className="text-muted text-[13px] font-normal">
                  {t(`reasonText.${value}`)}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={areaId} className="text-sm font-semibold">
          {t("justification")} <span className="text-muted font-medium">{t("required")}</span>
        </label>
        <textarea
          id={areaId}
          rows={3}
          maxLength={MAX_JUSTIFICATION}
          placeholder={t("placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={busy}
          aria-invalid={showError ? true : undefined}
          aria-describedby={`${areaId}-help`}
          className="border-line-strong bg-field aria-invalid:border-danger w-full resize-y rounded-2xl border px-4 py-3 text-[15px] leading-[1.5]"
        />
        <div id={`${areaId}-help`} className="flex justify-between gap-3 text-[13.5px]">
          {showError ? (
            <span role="alert" className="flex items-center gap-2">
              <Icon name="alertCircle" size={16} className="text-danger" />
              {t("tooShort", { min: MIN_JUSTIFICATION })}
            </span>
          ) : (
            <span className="text-muted">{t("help")}</span>
          )}
          <span className="text-muted ml-auto">
            {text.length}/{MAX_JUSTIFICATION}
          </span>
        </div>
      </div>

      <ul className="text-muted m-0 flex list-disc flex-col gap-1 pl-[18px] text-[13.5px] leading-[1.45]">
        <li>{t("notes.audit")}</li>
        <li>{t("notes.stays")}</li>
        <li>{t("notes.revert")}</li>
      </ul>
    </Modal>
  );
}
