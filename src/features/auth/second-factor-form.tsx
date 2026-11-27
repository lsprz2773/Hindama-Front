"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { verifySignInCode } from "./service";
import { useHttpClient } from "@/lib/http/browser";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http";

/** V-05 (analista) y su variante de administrador: pide el código TOTP tras la contraseña. */
export function SecondFactorForm({ admin = false }: { admin?: boolean }) {
  const t = useTranslations("SecondFactor");
  const router = useRouter();
  const toast = useToast();
  const http = useHttpClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6 || pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await verifySignInCode(http, code);
      router.push(
        result.next === "setup-two-factor"
          ? "/setup-two-factor"
          : result.next === "admin"
            ? "/admin"
            : "/projects",
      );
    } catch (e) {
      setPending(false);
      if (e instanceof ApiError && e.code === "auth.mfa_expired")
        setError(t("errors.sessionExpired"));
      else if (e instanceof ApiError && e.status === 429) setError(t("errors.locked"));
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

  return (
    <AuthShell
      title={t("heroTitle")}
      lead={admin ? t("introAdmin") : t("intro")}
      adminBadge={admin}
      aside={
        <div className="border-line bg-panel-2 flex max-w-[520px] items-start gap-3.5 rounded-[20px] border px-5 py-[18px] backdrop-blur-lg">
          <span
            aria-hidden="true"
            className="bg-progress-bg text-accent inline-flex size-10 flex-none items-center justify-center rounded-[13px]"
          >
            <Icon name="shield" />
          </span>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]">{t("tipTitle")}</b>
            <span className="text-muted text-sm leading-[1.5]">{t("tipText")}</span>
          </span>
        </div>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-[32px] font-medium tracking-[-0.025em]">
            {t("heading")}
          </h2>
          <p className="text-muted text-[15px]">{t("subheading")}</p>
        </div>
        <CodeInput
          legend={t("legend")}
          value={code}
          onChange={(next) => {
            setCode(next);
            setError(undefined);
          }}
          error={error}
          disabled={pending}
          autoFocus
        />
        <Button type="submit" size="lg" block loading={pending} disabled={code.length !== 6}>
          {pending ? t("verifying") : t("verify")}
        </Button>
        <Link
          href={admin ? "/admin/sign-in" : "/sign-in"}
          className="text-link text-[15px] font-bold"
        >
          {t("back")}
        </Link>
      </form>
    </AuthShell>
  );
}
