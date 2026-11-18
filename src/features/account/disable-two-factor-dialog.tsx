"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSubmit } from "@/components/dialogs/use-submit";
import { CodeInput } from "@/components/ui/code-input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { ApiError } from "@/lib/http";
import { disableTwoFactor } from "./service";

/** Desactivar el 2FA pide un código TOTP vigente (catálogo de estados, V-09). */
export function DisableTwoFactorDialog({
  open,
  onOpenChange,
  onDisabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisabled: () => void;
}) {
  const t = useTranslations("DisableTwoFactor");
  const td = useTranslations("Dialogs");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();

  const { busy, error, submit, reset } = useSubmit(
    () => disableTwoFactor(code),
    () => {
      onOpenChange(false);
      onDisabled();
    },
    (e) => {
      if (e instanceof ApiError && e.kind === "validation") {
        setCodeError(t("invalid"));
        return { title: t("invalid") };
      }
      return { title: td("genericError"), text: td("genericErrorText") };
    },
    { title: td("genericError"), text: td("genericErrorText") },
  );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setCode("");
          setCodeError(undefined);
        }
        onOpenChange(next);
      }}
      title={t("title")}
      description={t("description")}
      tone="warning"
      icon="shield"
      busy={busy}
      error={codeError ? undefined : error}
      footer={
        <ModalActions
          cancelLabel={td("cancel")}
          onCancel={() => onOpenChange(false)}
          actionLabel={t("submit")}
          onAction={() => void submit()}
          busy={busy}
          disabled={code.length !== 6}
          danger
        />
      }
    >
      <CodeInput
        legend={t("legend")}
        value={code}
        onChange={(next) => {
          setCode(next);
          setCodeError(undefined);
        }}
        error={codeError}
        disabled={busy}
        autoFocus
      />
    </Modal>
  );
}
