"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { DeleteDialog } from "@/components/dialogs/delete-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { LanguageSelector } from "@/components/ui/language-selector";
import { QueryState } from "@/components/ui/query-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { ME_KEY } from "@/lib/query/provider";
import { deleteAccount, useMe } from "./api";
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
  const [dialog, setDialog] = useState<"disable" | "delete" | null>(null);
  const router = useRouter();
  const http = useHttpClient();
  const client = useQueryClient();

  const me = useMe();
  const account = me.data;
  const twoFactor = account?.mfa_enabled === true;

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
                {account === undefined
                  ? t("twoFactorLoading")
                  : twoFactor
                    ? t("twoFactorOn")
                    : t("twoFactorOff")}
              </span>
            }
            action={
              account === undefined ? null : twoFactor ? (
                // El administrador no lo desactiva: la API lo exige (RF-86, CU-22 E2).
                account.role === "admin" ? null : (
                  <Button variant="secondary" onClick={() => setDialog("disable")}>
                    {t("disableTwoFactor")}
                  </Button>
                )
              ) : (
                <ButtonLink href="/profile/two-factor">{t("enableTwoFactor")}</ButtonLink>
              )
            }
          />
        </Card>

        {/* El administrador no elimina su cuenta desde la plataforma (403 `role.forbidden`). */}
        {account?.role === "analyst" ? (
          <Card id="profile-account" title={t("account")}>
            <Row
              icon="trash"
              title={t("deleteAccount.row")}
              text={t("deleteAccount.rowText")}
              action={
                <Button variant="danger" onClick={() => setDialog("delete")}>
                  {t("deleteAccount.button")}
                </Button>
              }
            />
          </Card>
        ) : null}

        <Card id="profile-prefs" title={t("preferences")}>
          <Row
            icon="globe"
            title={t("language")}
            text={t("languageNote")}
            action={<LanguageSelector variant="segmented" />}
          />
        </Card>
      </div>

      {account ? (
        <DeleteDialog
          open={dialog === "delete"}
          onOpenChange={(open) => setDialog(open ? "delete" : null)}
          title={t("deleteAccount.title")}
          description={t("deleteAccount.description")}
          confirmText={account.email}
          consequences={{
            heading: t("deleteAccount.removed"),
            items: [t("deleteAccount.removed1"), t("deleteAccount.removed2")],
          }}
          keeps={{
            heading: t("deleteAccount.kept"),
            items: [t("deleteAccount.kept1"), t("deleteAccount.kept2")],
          }}
          confirmLabel={t("deleteAccount.confirm")}
          mapError={(e) => deleteAccountError(e, t)}
          onConfirm={async () => {
            await deleteAccount(http, account.email);
            // La cookie ya la borró el BFF: se olvidan los datos en memoria y se vuelve al inicio.
            client.clear();
            toast.show({ type: "success", title: t("deleteAccount.done") });
            router.replace("/");
          }}
        />
      ) : null}

      <DisableTwoFactorDialog
        open={dialog === "disable"}
        onOpenChange={(open) => setDialog(open ? "disable" : null)}
        onDisabled={() => {
          void client.invalidateQueries({ queryKey: ME_KEY });
          toast.show({ type: "success", title: t("twoFactorDisabled") });
        }}
      />
    </div>
  );
}

/** Errores de `deleteAccount` que la persona puede resolver (CU-25 E1 a E3). */
function deleteAccountError(error: unknown, t: ReturnType<typeof useTranslations<"Profile">>) {
  if (error instanceof ApiError) {
    if (error.code === "account.active_run")
      return { title: t("deleteAccount.activeRun"), text: t("deleteAccount.activeRunText") };
    if (error.code === "account.confirmation_mismatch")
      return { title: t("deleteAccount.mismatch") };
    if (error.code === "account.deletion_incomplete")
      return { title: t("deleteAccount.incomplete"), text: t("deleteAccount.incompleteText") };
    if (error.status === 429) return { title: t("deleteAccount.rateLimited") };
    if (error.code === "role.forbidden") return { title: t("deleteAccount.forbidden") };
  }
  return {
    title: t("deleteAccount.failed"),
    text:
      error instanceof ApiError && error.requestId
        ? t("deleteAccount.reference", { id: error.requestId })
        : undefined,
  };
}
