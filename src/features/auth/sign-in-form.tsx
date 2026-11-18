"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http";
import { isEmail } from "@/lib/validation";
import { signIn } from "./service";

type Errors = { email?: string; password?: string };

export function SignInForm() {
  const t = useTranslations("SignIn");
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const next: Errors = {};
    if (!email.trim()) next.email = t("errors.emailRequired");
    else if (!isEmail(email)) next.email = t("errors.emailInvalid");
    if (!password) next.password = t("errors.passwordRequired");
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;

    setPending(true);
    try {
      const result = await signIn({ email: email.trim(), password });
      if (result.next === "two-factor") router.push("/sign-in/two-factor");
      else if (result.next === "verify-email") router.push("/sign-up/verify");
      else router.push("/projects");
    } catch (error) {
      setPending(false);
      if (error instanceof ApiError && error.kind === "unauthorized") {
        // Mensaje genérico: no revela si el correo existe (RF-06).
        setFormError(t("errors.invalidCredentials"));
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError(t("errors.locked"));
      } else {
        toast.show({
          type: "error",
          title: t("errors.networkTitle"),
          text: t("errors.networkText"),
          action: { label: t("errors.retry"), onClick: () => void onSubmit(event) },
        });
      }
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[32px] font-medium tracking-[-0.025em]">{t("heading")}</h2>
        <p className="text-muted text-[15px]">{t("subheading")}</p>
      </div>

      {formError ? (
        <div
          role="alert"
          className="border-danger bg-danger-bg flex items-start gap-3 rounded-[18px] border px-4 py-3.5"
        >
          <Icon name="alertCircle" size={20} strokeWidth={2.2} className="text-danger mt-px" />
          <span className="text-[14px] leading-[1.45]">{formError}</span>
        </div>
      ) : null}

      <TextField
        label={t("email")}
        type="email"
        name="email"
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <PasswordField
        label={t("password")}
        name="password"
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
        {t("noAccount")}{" "}
        <Link href="/sign-up" className="text-link font-bold">
          {t("createAccount")}
        </Link>
      </p>

      <p className="border-line text-muted mt-2 border-t pt-[18px] text-[13px] leading-[1.55]">
        {t("legal")}{" "}
        <Link href="/terms" className="text-link">
          {t("terms")}
        </Link>{" "}
        {t("and")}{" "}
        <Link href="/privacy" className="text-link">
          {t("privacy")}
        </Link>
        .
      </p>
    </form>
  );
}
