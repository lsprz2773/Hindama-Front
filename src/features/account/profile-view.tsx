"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { DeleteDialog } from "@/components/dialogs/delete-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { NOTICE_KEY, TWO_FACTOR_KEY, useFlag, writeFlag } from "./browser-store";
import { ChangePasswordDialog } from "./change-password-dialog";
import { DisableTwoFactorDialog } from "./disable-two-factor-dialog";
import { SESSION_STUB, deleteAccount } from "./service";

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

/** V-09. Perfil de usuario: datos, seguridad (contraseña y 2FA), idioma y baja de la cuenta. */
export function ProfileView() {
  const t = useTranslations("Profile");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const twoFactor = useFlag(TWO_FACTOR_KEY) === "on";
  const [dialog, setDialog] = useState<"password" | "delete" | "disable" | null>(null);

  const initials = SESSION_STUB.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section
        aria-labelledby="profile-data"
        className="border-line bg-panel flex min-w-0 flex-[1_1_320px] flex-col gap-5 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="bg-accent text-on-accent font-display inline-flex size-16 items-center justify-center rounded-full text-2xl font-semibold"
          >
            {initials}
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 id="profile-data" className="text-xl font-semibold">
              {SESSION_STUB.name}
            </h2>
            <span className="text-muted text-sm break-all">{SESSION_STUB.email}</span>
          </div>
        </div>
        <dl className="m-0 flex flex-col gap-3.5">
          <div>
            <dt className="text-muted text-[13px]">{t("role")}</dt>
            <dd className="m-0 mt-0.5 font-semibold">{t("analyst")}</dd>
          </div>
          <div>
            <dt className="text-muted text-[13px]">{t("memberSince")}</dt>
            <dd className="m-0 mt-0.5 font-semibold">
              {format.dateTime(new Date(SESSION_STUB.memberSince), {
                dateStyle: "medium",
                timeZone: "UTC",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-[13px]">{t("terms")}</dt>
            <dd className="m-0 mt-0.5 font-semibold">
              {t("termsValue", {
                version: SESSION_STUB.termsVersion,
                date: format.dateTime(new Date(SESSION_STUB.termsAcceptedAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </dd>
          </div>
        </dl>
        <p className="text-muted text-[13px]">{t("roleNote")}</p>
      </section>

      <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-5">
        <Card id="profile-security" title={t("security")}>
          <Row
            icon="lock"
            title={t("password")}
            text={t("passwordChanged", { days: SESSION_STUB.passwordChangedDaysAgo })}
            action={
              <Button variant="secondary" onClick={() => setDialog("password")}>
                {t("changePassword")}
              </Button>
            }
          />
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

        <Card id="profile-delete" title={t("deleteAccount")}>
          <p className="text-muted text-sm leading-[1.55]">
            {t("deleteText", { count: SESSION_STUB.projects })}
          </p>
          <div>
            <Button variant="danger" onClick={() => setDialog("delete")}>
              {t("deleteButton")}
            </Button>
          </div>
        </Card>
      </div>

      <ChangePasswordDialog
        open={dialog === "password"}
        onOpenChange={(open) => setDialog(open ? "password" : null)}
      />
      <DisableTwoFactorDialog
        open={dialog === "disable"}
        onOpenChange={(open) => setDialog(open ? "disable" : null)}
        onDisabled={() => {
          writeFlag(TWO_FACTOR_KEY, null);
          toast.show({ type: "success", title: t("twoFactorDisabled") });
        }}
      />
      <DeleteDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title={t("deleteDialog.title")}
        description={t("deleteDialog.description")}
        confirmText={SESSION_STUB.email}
        consequences={{
          heading: t("deleteDialog.removed"),
          items: [
            t("deleteDialog.removed1"),
            t("deleteDialog.removed2", { count: SESSION_STUB.projects }),
            t("deleteDialog.removed3"),
          ],
        }}
        keeps={{
          heading: t("deleteDialog.kept"),
          items: [t("deleteDialog.kept1"), t("deleteDialog.kept2")],
        }}
        confirmLabel={t("deleteButton")}
        onConfirm={async () => {
          await deleteAccount();
          writeFlag(NOTICE_KEY, "account_deleted");
          router.push("/");
        }}
      />
    </div>
  );
}
