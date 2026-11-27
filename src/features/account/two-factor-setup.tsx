"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { CopyButton } from "@/components/ui/copy-button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { ME_KEY } from "@/lib/query/provider";
import { confirmTwoFactor, formatSecret, otpauthUri, startTwoFactorSetup, useMe } from "./api";
import { TotpQr } from "./totp-qr";

const APPS = ["Google Authenticator", "Microsoft Authenticator", "1Password"];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-7 backdrop-blur-lg">
      <span
        aria-hidden="true"
        className="font-display text-accent text-[40px] leading-none font-medium"
      >
        {n}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </li>
  );
}

/**
 * V-10 (activar 2FA desde el perfil) y V-11 (obligatorio para administradores, sin «Cancelar»).
 * Tres pasos: instalar una app TOTP, escanear el QR y confirmar con un código de 6 dígitos.
 */
export function TwoFactorSetup({ mandatory = false }: { mandatory?: boolean }) {
  const t = useTranslations("TwoFactorSetup");
  const router = useRouter();
  const toast = useToast();
  const http = useHttpClient();
  const client = useQueryClient();
  const me = useMe();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // Una clave por visita: pedirla otra vez invalidaría la que ya está en la app de la persona.
  const setup = useQuery({
    queryKey: ["mfa-setup"],
    queryFn: ({ signal }) => startTwoFactorSetup(http, signal),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const secret = setup.data;
  const uri = secret && me.data ? otpauthUri(me.data.email, secret) : undefined;

  async function confirm() {
    if (code.length !== 6 || pending) return;
    setPending(true);
    setError(undefined);
    try {
      await confirmTwoFactor(http, code);
      await client.invalidateQueries({ queryKey: ME_KEY });
      toast.show({ type: "success", title: t("enabled") });
      router.push(mandatory ? "/admin" : "/profile");
    } catch (e) {
      setPending(false);
      if (e instanceof ApiError && e.kind === "validation") setError(t("errors.invalid"));
      else
        toast.show({
          type: "error",
          title: t("errors.networkTitle"),
          text: t("errors.networkText"),
          action: { label: t("errors.retry"), onClick: () => void confirm() },
        });
    }
  }

  return (
    <>
      {mandatory ? (
        <div
          role="note"
          className="border-line bg-panel-2 border-l-accent flex items-start gap-3 rounded-[18px] border border-l-4 px-4 py-3.5"
        >
          <Icon name="lock" className="text-accent" />
          <div className="flex flex-col gap-1">
            <b className="text-sm">{t("mandatoryTitle")}</b>
            <span className="text-muted text-sm leading-[1.5]">{t("mandatoryText")}</span>
          </div>
        </div>
      ) : null}

      <ol className="stagger m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-stretch gap-5 p-0">
        <Step n={1} title={t("step1.title")}>
          <p className="text-muted text-[14.5px] leading-[1.55]">{t("step1.text")}</p>
          <ul className="stagger m-0 flex list-none flex-col gap-2 p-0">
            {APPS.map((app) => (
              <li
                key={app}
                className="border-line bg-panel-2 flex items-center gap-2.5 rounded-[20px] border px-3.5 py-3 text-[14.5px]"
              >
                <Icon name="shield" size={18} className="text-accent" />
                {app}
              </li>
            ))}
          </ul>
        </Step>

        <Step n={2} title={t("step2.title")}>
          {setup.isError ? (
            <div role="alert" className="flex flex-col gap-3">
              <span className="text-danger text-sm">{t("step2.failed")}</span>
              <Button variant="secondary" onClick={() => void setup.refetch()}>
                {t("errors.retry")}
              </Button>
            </div>
          ) : uri && secret ? (
            <>
              <TotpQr value={uri} label={t("step2.qrLabel")} />
              <span className="text-muted text-[13.5px]">{t("step2.manual")}</span>
              <div className="border-line bg-code-bg flex items-center gap-2.5 rounded-[14px] border py-2 pr-2 pl-3.5">
                <code className="flex-1 font-mono text-sm tracking-[0.06em]">
                  {formatSecret(secret)}
                </code>
                <CopyButton
                  value={secret}
                  what={t("step2.keyLabel")}
                  size="sm"
                  className="min-h-10 px-3 text-sm"
                />
              </div>
            </>
          ) : (
            <div role="status" aria-label={t("step2.loading")} className="flex flex-col gap-3">
              <div className="bg-track mx-auto size-[220px] max-w-full animate-pulse rounded-[18px]" />
            </div>
          )}
        </Step>

        <Step n={3} title={t("step3.title")}>
          <p className="text-muted text-[14.5px] leading-[1.55]">{t("step3.text")}</p>
          <CodeInput
            legend={t("step3.legend")}
            value={code}
            onChange={(next) => {
              setCode(next);
              setError(undefined);
            }}
            error={error}
            disabled={pending}
          />
          <Button
            size="lg"
            className="mt-auto"
            onClick={() => void confirm()}
            loading={pending}
            disabled={code.length !== 6 || !secret}
          >
            {pending ? t("confirming") : t("confirm")}
          </Button>
          {!mandatory ? (
            <ButtonLink href="/profile" variant="secondary">
              {t("cancel")}
            </ButtonLink>
          ) : null}
        </Step>
      </ol>
    </>
  );
}
