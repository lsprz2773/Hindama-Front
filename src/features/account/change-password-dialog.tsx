"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useSubmit } from "@/components/dialogs/use-submit";
import { Modal, ModalActions } from "@/components/ui/modal";
import { PasswordRules } from "@/components/ui/password-rules";
import { PasswordField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/http";
import { isPasswordValid } from "@/lib/password";
import { changePassword } from "./service";

/** C-17. Cambiar la contraseña desde el perfil: actual, nueva con las reglas de RF-03 y confirmación. */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("ChangePassword");
  const td = useTranslations("Dialogs");
  const ids = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState<{ current?: string; next?: string }>({});

  const mismatch = confirm.length > 0 && confirm !== next;
  const valid = current.length > 0 && isPasswordValid(next) && confirm === next;

  const { busy, error, submit, reset } = useSubmit(
    () => changePassword({ current, next }),
    () => setDone(true),
    (e) => {
      if (e instanceof ApiError && e.code === "password.incorrect") {
        setFieldError({ current: t("errors.currentWrong") });
        return { title: t("errors.currentWrong") };
      }
      if (e instanceof ApiError && e.code === "password.reused") {
        setFieldError({ next: t("errors.reused") });
        return { title: t("errors.reused") };
      }
      return { title: td("genericError"), text: td("genericErrorText") };
    },
    { title: td("genericError"), text: td("genericErrorText") },
  );

  function close(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(false);
      setTouched(false);
      setFieldError({});
    }
    onOpenChange(nextOpen);
  }

  function onSubmit() {
    setTouched(true);
    setFieldError({});
    if (!valid) return;
    void submit();
  }

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={t("title")}
      description={t("description")}
      tone="accent"
      icon="lock"
      busy={busy}
      error={fieldError.current || fieldError.next ? undefined : error}
      success={
        done ? { title: t("successTitle"), text: t("successText"), action: t("done") } : undefined
      }
      footer={
        <ModalActions
          cancelLabel={td("cancel")}
          onCancel={() => close(false)}
          actionLabel={t("submit")}
          onAction={onSubmit}
          busy={busy}
          disabled={touched && !valid}
        />
      }
    >
      <div className="flex flex-col gap-4" id={ids}>
        <PasswordField
          label={t("current")}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={
            fieldError.current ?? (touched && !current ? t("errors.currentRequired") : undefined)
          }
          disabled={busy}
        />
        <div className="flex flex-col gap-2">
          <PasswordField
            label={t("new")}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={
              fieldError.next ?? (touched && !isPasswordValid(next) ? t("errors.weak") : undefined)
            }
            disabled={busy}
          />
          <PasswordRules value={next} />
        </div>
        <PasswordField
          label={t("confirm")}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? t("errors.mismatch") : undefined}
          disabled={busy}
        />
      </div>
    </Modal>
  );
}
