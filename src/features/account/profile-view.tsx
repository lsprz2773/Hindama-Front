"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { LanguageSelector } from "@/components/ui/language-selector";
import { QueryState } from "@/components/ui/query-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useMe } from "./api";
import { TWO_FACTOR_KEY, useFlag, writeFlag } from "./browser-store";
import { DisableTwoFactorDialog } from "./disable-two-factor-dialog";

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="border-line bg-panel-2 flex flex-wrap items-center gap-4 rounded-[20px] border px-[18px] py-4">
      <span
        aria-hidden="true"
        className="bg-progress-bg text-accent inline-flex size-11 flex-none items-center justify-center rounded-[14px]"
      >
        <Icon name={icon} />
      </span>
      <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
        <b className="text-[15px]">{title}</b>
        <span className="text-muted text-[13.5px] leading-[1.45]">{text}</span>
      </div>
      {action}
    </div>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * V-09. Perfil de usuario: datos (`getMe`), seguridad (2FA) e idioma.
 * TODO(api): el estado del 2FA sigue simulado; V-10 no tiene contrato todavía.
 */
export function ProfileView() {
  const t = useTranslations("Profile");
  const format = useFormatter();
  const toast = useToast();
  const twoFactor = useFlag(TWO_FACTOR_KEY) === "on";
  const [dialog, setDialog] = useState<"disable" | null>(null);

  const me = useMe();

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section
        aria-labelledby="profile-data"
        className="border-line bg-panel flex min-w-0 flex-[1_1_320px] flex-col gap-5 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <QueryState
          query={me}
          subject={t("subject")}
          skeleton={
            <div role="status" aria-label={t("loading")} className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <Skeleton className="size-16 rounded-full" />
                <SkeletonText lines={2} className="flex-1" />
              </div>
              <SkeletonText lines={4} />
            </div>
          }
        >
          {(data) => (
            <>
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="bg-accent text-on-accent font-display inline-flex size-16 items-center justify-center rounded-full text-2xl font-semibold"
                >
                  {initialsOf(data.name)}
                </span>
                <div className="flex min-w-0 flex-col">
                  <h2 id="profile-data" className="text-xl font-semibold break-words">
                    {data.name}
                  </h2>
                  <span className="text-muted text-sm break-all">{data.email}</span>
                </div>
              </div>
              {/* TODO(api): «Miembro desde» no está en `Me` (contrato 0.6.0); se quitó hasta que exista. */}
              <dl className="m-0 flex flex-col gap-3.5">
                <div>
                  <dt className="text-muted text-[13px]">{t("role")}</dt>
                  <dd className="m-0 mt-0.5 font-semibold">{t(data.role)}</dd>
                </div>
                <div>
                  <dt className="text-muted text-[13px]">{t("terms")}</dt>
                  <dd className="m-0 mt-0.5 font-semibold">
                    {data.terms.accepted_version && data.terms.accepted_at
                      ? t("termsValue", {
                          version: data.terms.accepted_version,
                          date: format.dateTime(new Date(data.terms.accepted_at), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }),
                        })
                      : t("termsPending", { version: data.terms.current_version })}
                  </dd>
                </div>
              </dl>
              <p className="text-muted text-[13px]">{t("roleNote")}</p>
            </>
          )}
        </QueryState>
      </section>

      <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-5">
        <Card id="profile-security" title={t("security")}>
          <Row
            icon="shield"
            title={t("twoFactor")}
            text={
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${twoFactor ? "bg-success" : "bg-warning"}`}
                />
                {twoFactor ? t("twoFactorOn") : t("twoFactorOff")}
              </span>
            }
            action={
              twoFactor ? (
                <Button variant="secondary" onClick={() => setDialog("disable")}>
                  {t("disableTwoFactor")}
                </Button>
              ) : (
                <ButtonLink href="/profile/two-factor">{t("enableTwoFactor")}</ButtonLink>
              )
            }
          />
        </Card>

        <Card id="profile-prefs" title={t("preferences")}>
          <Row
            icon="globe"
            title={t("language")}
            text={t("languageNote")}
            action={<LanguageSelector variant="segmented" />}
          />
        </Card>
      </div>

      <DisableTwoFactorDialog
        open={dialog === "disable"}
        onOpenChange={(open) => setDialog(open ? "disable" : null)}
        onDisabled={() => {
          writeFlag(TWO_FACTOR_KEY, null);
          toast.show({ type: "success", title: t("twoFactorDisabled") });
        }}
      />
    </div>
  );
}
