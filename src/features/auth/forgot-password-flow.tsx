"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { Icon } from "@/components/ui/icon";
import { PasswordRules } from "@/components/ui/password-rules";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { isPasswordValid } from "@/lib/password";
import { formatCountdown, useCountdown } from "@/lib/use-countdown";
import { isEmail } from "@/lib/validation";
import { confirmResetCode, requestPasswordReset, resetPassword } from "./service";

type Step = 1 | 2 | 3;
const STEPS: Step[] = [1, 2, 3];
const STEP_KEYS = { 1: "email", 2: "code", 3: "password" } as const;
const CODE_LENGTH = 6;
const RESEND_SECONDS = 42;

/** V-06. Recuperar contraseña en tres pasos: correo, código y contraseña nueva (RF-05). */
export function ForgotPasswordFlow() {
  const t = useTranslations("ForgotPassword");
  const router = useRouter();
  const toast = useToast();
  const countdown = useCountdown(RESEND_SECONDS);

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    code?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  function networkToast(retry: () => void) {
    toast.show({
      type: "error",
      title: t("errors.networkTitle"),
      text: t("errors.networkText"),
      action: { label: t("errors.retry"), onClick: retry },
    });
  }

  async function sendEmail(event?: FormEvent) {
    event?.preventDefault();
    if (pending) return;
    if (!email.trim()) return setErrors({ email: t("errors.emailRequired") });
    if (!isEmail(email)) return setErrors({ email: t("errors.emailInvalid") });
    setErrors({});
    setPending(true);
    try {
      await requestPasswordReset(email.trim());
      setCode("");
      countdown.restart();
      setStep(2);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setErrors({ email: t("errors.rateLimit") });
      else networkToast(() => void sendEmail());
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (pending || code.length !== CODE_LENGTH) return;
    setErrors({});
    setPending(true);
    try {
      await confirmResetCode({ email: email.trim(), code });
      setStep(3);
    } catch (e) {
      if (e instanceof ApiError && e.code === "code.expired")
        setErrors({ code: t("errors.codeExpired") });
      else if (e instanceof ApiError && e.status === 429) setErrors({ code: t("errors.locked") });
      else if (e instanceof ApiError && e.kind === "validation")
        setErrors({ code: t("errors.codeInvalid") });
      else networkToast(() => void verifyCode(event));
    } finally {
      setPending(false);
    }
  }

  async function resendCode() {
    if (!countdown.done || resending) return;
    setResending(true);
    try {
      await requestPasswordReset(email.trim());
      setCode("");
      setErrors({});
      countdown.restart();
      toast.show({ type: "success", title: t("resentTitle"), text: t("resentText") });
    } catch {
      toast.show({ type: "error", title: t("errors.resendTitle"), text: t("errors.networkText") });
    } finally {
      setResending(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const next: typeof errors = {};
    if (!password) next.password = t("errors.passwordRequired");
    else if (!isPasswordValid(password)) next.password = t("errors.passwordWeak");
    if (!confirm) next.confirm = t("errors.confirmRequired");
    else if (confirm !== password) next.confirm = t("errors.confirmMismatch");
    setErrors(next);
    if (next.password || next.confirm) return;

    setPending(true);
    try {
      await resetPassword({ email: email.trim(), code, password });
      toast.show({ type: "success", title: t("successTitle"), text: t("successText") });
      router.push("/sign-in");
    } catch (e) {
      setPending(false);
      if (e instanceof ApiError && e.code === "code.expired") {
        // El código venció mientras tanto: vuelve al paso 2.
        setCode("");
        setStep(2);
        setErrors({ code: t("errors.codeExpired") });
      } else if (e instanceof ApiError && e.code === "password.reused") {
        setErrors({ password: t("errors.passwordReused") });
      } else networkToast(() => void changePassword(event));
    }
  }

  const stepper = (
    <ol aria-label={t("stepsLabel")} className="m-0 flex list-none flex-wrap gap-2.5 p-0">
      {STEPS.map((n) => {
        const current = n === step;
        const done = n < step;
        return (
          <li
            key={n}
            aria-current={current ? "step" : undefined}
            className={cn(
              "border-line flex items-center gap-2.5 rounded-full border py-2.5 pr-4 pl-2.5",
              current ? "bg-panel-2" : "bg-transparent",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full text-[13px] font-bold",
                done || current ? "text-on-accent" : "bg-track text-muted",
                done ? "bg-success" : current ? "bg-accent" : "",
              )}
            >
              {n}
            </span>
            <span className="text-sm font-semibold">{t(`steps.${STEP_KEYS[n]}`)}</span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <AuthShell title={t("heroTitle")} lead={t("heroLead")} aside={stepper}>
      <div className="flex flex-col gap-5">
        {step === 1 ? (
          <form noValidate onSubmit={sendEmail} className="animate-fade-in flex flex-col gap-5">
            <Heading title={t("step1.heading")} text={t("step1.text")} />
            <TextField
              label={t("email")}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Button type="submit" size="lg" block loading={pending}>
              {pending ? t("sending") : t("step1.submit")}
            </Button>
          </form>
        ) : null}

        {step === 2 ? (
          <form noValidate onSubmit={verifyCode} className="animate-fade-in flex flex-col gap-5">
            <Heading
              title={t("step2.heading")}
              text={
                <>
                  {t.rich("step2.text", {
                    email,
                    b: (chunks) => <b className="text-fg">{chunks}</b>,
                  })}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setStep(1);
                    }}
                    className="text-link cursor-pointer font-bold underline"
                  >
                    {t("step2.useOther")}
                  </button>
                </>
              }
            />
            <CodeInput
              legend={t("codeLegend")}
              value={code}
              onChange={(next) => {
                setCode(next);
                setErrors({});
              }}
              length={CODE_LENGTH}
              error={errors.code}
              disabled={pending}
              autoFocus
            />
            <p className="text-muted -mt-2 text-[13px]">{t("step2.hint")}</p>
            <Button
              type="submit"
              size="lg"
              block
              loading={pending}
              disabled={code.length !== CODE_LENGTH}
            >
              {pending ? t("verifying") : t("step2.submit")}
            </Button>
            <p className="text-muted text-sm">
              {t("step2.noCode")}{" "}
              <button
                type="button"
                onClick={resendCode}
                disabled={!countdown.done || resending}
                className="text-link disabled:text-muted cursor-pointer font-bold underline disabled:cursor-not-allowed"
              >
                {countdown.done
                  ? resending
                    ? t("sending")
                    : t("step2.resend")
                  : t("step2.resendIn", { time: formatCountdown(countdown.remaining) })}
              </button>
            </p>
          </form>
        ) : null}

        {step === 3 ? (
          <form
            noValidate
            onSubmit={changePassword}
            className="animate-fade-in flex flex-col gap-5"
          >
            <div
              role="status"
              className="border-line bg-panel-2 flex items-center gap-2.5 self-start rounded-full border py-2 pr-3.5 pl-2.5 text-[13.5px] font-semibold"
            >
              <Icon name="check" size={18} strokeWidth={2.4} className="text-success" />
              {t("verified")}
            </div>
            <Heading title={t("step3.heading")} text={t("step3.text")} />
            <div className="flex flex-col gap-2">
              <PasswordField
                label={t("step3.password")}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />
              <PasswordRules value={password} />
            </div>
            <PasswordField
              label={t("step3.confirm")}
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
            />
            <Button type="submit" size="lg" block loading={pending}>
              {pending ? t("saving") : t("step3.submit")}
            </Button>
          </form>
        ) : null}

        <Link href="/sign-in" className="text-link text-[15px] font-bold">
          {t("backToSignIn")}
        </Link>
      </div>
    </AuthShell>
  );
}

function Heading({ title, text }: { title: string; text: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="font-display text-[32px] font-medium tracking-[-0.025em]">{title}</h2>
      <p className="text-muted text-[15px] leading-[1.5]">{text}</p>
    </div>
  );
}
