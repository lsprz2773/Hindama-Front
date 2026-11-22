"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { adminSignIn } from "@/features/account/service";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http";
import { isEmail } from "@/lib/validation";

const STEPS = ["credentials", "code", "panel"] as const;

/** V-35. Acceso independiente de administradores: siempre sigue con el código TOTP (RF-09, RF-86). */
export function AdminSignInForm() {
  const t = useTranslations("AdminSignIn");
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const next: typeof errors = {};
    if (!email.trim()) next.email = t("errors.emailRequired");
    else if (!isEmail(email)) next.email = t("errors.emailInvalid");
    if (!password) next.password = t("errors.passwordRequired");
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;

    setPending(true);
    try {
      await adminSignIn({ email: email.trim(), password });
      router.push("/admin/sign-in/two-factor");
    } catch (e) {
      setPending(false);
      // Mensaje genérico: no revela si la cuenta existe ni si es de administrador (RF-06).
      if (e instanceof ApiError && (e.kind === "unauthorized" || e.kind === "validation"))
        setFormError(t("errors.invalid"));
      else
        toast.show({
          type: "error",
          title: t("errors.networkTitle"),
          text: t("errors.networkText"),
          action: { label: t("errors.retry"), onClick: () => void onSubmit(event) },
        });
    }
  }

  return (
    <AuthShell
      title={t("heroTitle")}
      lead={t("heroLead")}
      adminBadge
      aside={
        <figure className="border-line bg-panel-2 m-0 flex max-w-[520px] flex-col gap-3.5 rounded-[22px] border px-[22px] py-5 backdrop-blur-lg">
          <ol className="stagger m-0 flex list-none flex-col gap-3 p-0">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="bg-progress-bg text-link inline-flex size-8 flex-none items-center justify-center rounded-full text-sm font-bold"
                >
                  {i + 1}
                </span>
                <span className="flex flex-col gap-px">
                  <b className="text-[15px]">{t(`steps.${step}.title`)}</b>
                  <span className="text-muted text-[13px]">{t(`steps.${step}.text`)}</span>
                </span>
              </li>
            ))}
          </ol>
          <figcaption className="text-muted text-[12.5px]">{t("noSelfAssign")}</figcaption>
        </figure>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-[32px] font-medium tracking-[-0.025em]">
            {t("heading")}
          </h2>
          <p className="text-muted text-[15px]">{t("subheading")}</p>
        </div>
        {formError ? (
          <div
            role="alert"
            className="border-danger bg-danger-bg flex items-start gap-3 rounded-[18px] border px-4 py-3.5"
          >
            <Icon name="alertCircle" size={20} strokeWidth={2.2} className="text-danger mt-px" />
            <span className="text-sm leading-[1.45]">{formError}</span>
          </div>
        ) : null}
        <TextField
          label={t("email")}
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField
          label={t("password")}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          labelAside={
            <Link href="/forgot-password" className="text-link text-sm">
              {t("forgot")}
            </Link>
          }
        />
        <Button type="submit" size="lg" block loading={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
        <p className="text-muted text-[15px]">
          {t("analyst")}{" "}
          <Link href="/sign-in" className="text-link font-bold">
            {t("analystLink")}
          </Link>
        </p>
        <p className="border-line text-muted mt-2 border-t pt-[18px] text-[13px] leading-[1.55]">
          {t("audit")}
        </p>
      </form>
    </AuthShell>
  );
}
