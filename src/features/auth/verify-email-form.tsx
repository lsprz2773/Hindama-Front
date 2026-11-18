"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http";
import { formatCountdown, useCountdown } from "@/lib/use-countdown";
import { usePendingEmail } from "./pending-email";
import { resendVerificationCode, verifyEmail } from "./service";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 42;

export function VerifyEmailForm() {
  const t = useTranslations("VerifyEmail");
  const router = useRouter();
  const toast = useToast();
  const email = usePendingEmail();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const countdown = useCountdown(RESEND_SECONDS);

  const complete = code.length === CODE_LENGTH;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!complete || pending) return;
    setError(undefined);
    setPending(true);
    try {
      await verifyEmail({ email, code });
      toast.show({ type: "success", title: t("successTitle"), text: t("successText") });
      router.push("/sign-in");
    } catch (e) {
      setPending(false);
      if (e instanceof ApiError && e.status === 429) setError(t("errors.locked"));
      else if (e instanceof ApiError && e.code === "code.expired") setError(t("errors.expired"));
      else if (e instanceof ApiError && e.kind === "validation") setError(t("errors.invalid"));
      else
        toast.show({
          type: "error",
          title: t("errors.networkTitle"),
          text: t("errors.networkText"),
          action: { label: t("errors.retry"), onClick: () => void onSubmit(event) },
        });
    }
  }

  async function onResend() {
    if (!countdown.done || resending) return;
    setResending(true);
    try {
      await resendVerificationCode(email);
      setCode("");
      setError(undefined);
      countdown.restart();
      toast.show({ type: "success", title: t("resentTitle"), text: t("resentText") });
    } catch {
      toast.show({ type: "error", title: t("errors.resendTitle"), text: t("errors.networkText") });
    } finally {
      setResending(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[32px] font-medium tracking-[-0.025em]">{t("heading")}</h2>
        <p className="text-muted text-[15px] leading-[1.5]">
          {email
            ? t.rich("subheading", { email, b: (chunks) => <b className="text-fg">{chunks}</b> })
            : t("subheadingNoEmail")}
        </p>
      </div>

      <CodeInput
        legend={t("legend")}
        value={code}
        onChange={(next) => {
          setCode(next);
          setError(undefined);
        }}
        length={CODE_LENGTH}
        error={error}
        disabled={pending}
        autoFocus
      />

      <Button type="submit" size="lg" block loading={pending} disabled={!complete}>
        {pending ? t("submitting") : t("submit")}
      </Button>

      <p className="text-muted text-[15px]">
        {t("noCode")}{" "}
        <button
          type="button"
          onClick={onResend}
          disabled={!countdown.done || resending}
          className="text-link disabled:text-muted cursor-pointer font-bold disabled:cursor-not-allowed"
        >
          {countdown.done
            ? resending
              ? t("resending")
              : t("resend")
            : t("resendIn", { time: formatCountdown(countdown.remaining) })}
        </button>
      </p>

      <p className="border-line text-muted border-t pt-[18px] text-sm">
        {t("wrongEmail")}{" "}
        <Link href="/sign-up" className="text-link font-bold">
          {t("backToSignUp")}
        </Link>
      </p>
    </form>
  );
}
