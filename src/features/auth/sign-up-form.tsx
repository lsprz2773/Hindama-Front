"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PasswordRules } from "@/components/ui/password-rules";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http";
import { isPasswordValid } from "@/lib/password";
import { isEmail } from "@/lib/validation";
import { setPendingEmail } from "./pending-email";
import { signUp } from "./service";

type Errors = {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  terms?: string;
};

export function SignUpForm() {
  const t = useTranslations("SignUp");
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [exists, setExists] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const next: Errors = {};
    if (!name.trim()) next.name = t("errors.nameRequired");
    if (!email.trim()) next.email = t("errors.emailRequired");
    else if (!isEmail(email)) next.email = t("errors.emailInvalid");
    if (!password) next.password = t("errors.passwordRequired");
    else if (!isPasswordValid(password)) next.password = t("errors.passwordWeak");
    if (!confirm) next.confirm = t("errors.confirmRequired");
    else if (confirm !== password) next.confirm = t("errors.confirmMismatch");
    if (!accepted) next.terms = t("errors.termsRequired");
    setErrors(next);
    setExists(false);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password, acceptedTerms: accepted });
      setPendingEmail(email.trim());
      router.push("/sign-up/verify");
    } catch (error) {
      setPending(false);
      if (error instanceof ApiError && error.kind === "conflict") {
        // Respuesta genérica: no confirma que el correo ya existe.
        setExists(true);
      } else if (error instanceof ApiError && error.status === 429) {
        toast.show({
          type: "warning",
          title: t("errors.rateLimitTitle"),
          text: t("errors.rateLimitText"),
        });
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
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[32px] font-medium tracking-[-0.025em]">{t("heading")}</h2>
        <p className="text-muted text-[15px]">{t("subheading")}</p>
      </div>

      <TextField
        label={t("name")}
        name="name"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <TextField
        label={t("email")}
        type="email"
        name="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <div className="flex flex-col gap-2">
        <PasswordField
          label={t("password")}
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <PasswordRules value={password} />
      </div>
      <PasswordField
        label={t("confirm")}
        name="confirm"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={errors.confirm}
      />

      <div className="flex flex-col gap-2">
        <label className="text-muted flex cursor-pointer items-start gap-3 text-sm leading-[1.5]">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            aria-invalid={errors.terms ? true : undefined}
            aria-describedby={errors.terms ? "terms-error" : undefined}
            className="accent-accent mt-px size-5 flex-none"
          />
          <span>
            {t.rich("acceptance", {
              terms: (chunks) => (
                <Link href="/terms" className="text-link">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" className="text-link">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {errors.terms ? (
          <p id="terms-error" role="alert" className="flex items-start gap-2 text-[13.5px]">
            <Icon name="alertCircle" size={16} className="text-danger mt-0.5" />
            <span>{errors.terms}</span>
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" block loading={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>

      {exists ? (
        <div
          role="status"
          className="border-line bg-panel-2 border-l-success flex items-start gap-3 rounded-[18px] border border-l-4 px-4 py-3.5"
        >
          <Icon name="mail" size={20} className="text-success mt-px" />
          <div className="flex min-w-0 flex-col gap-1">
            <b className="text-sm">{t("existsTitle")}</b>
            <span className="text-muted text-sm leading-[1.5]">
              {t.rich("existsText", {
                signIn: (chunks) => (
                  <Link href="/sign-in" className="text-link font-bold">
                    {chunks}
                  </Link>
                ),
                recover: (chunks) => (
                  <Link href="/forgot-password" className="text-link font-bold">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </div>
        </div>
      ) : null}

      <p className="text-muted text-[15px]">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className="text-link font-bold">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
