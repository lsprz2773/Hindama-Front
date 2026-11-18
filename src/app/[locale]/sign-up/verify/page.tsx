import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { Icon } from "@/components/ui/icon";
import { VerifyEmailForm } from "@/features/auth/verify-email-form";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-up/verify">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "VerifyEmail" });
  return { title: t("meta") };
}

export default async function VerifyEmailPage({ params }: PageProps<"/[locale]/sign-up/verify">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "VerifyEmail" });

  return (
    <AuthShell
      title={t("heroTitle")}
      lead={t("heroLead")}
      aside={
        <div className="border-line bg-panel-2 flex max-w-[520px] items-start gap-3.5 rounded-[20px] border px-5 py-[18px] backdrop-blur-lg">
          <span
            aria-hidden="true"
            className="bg-progress-bg text-accent inline-flex size-10 flex-none items-center justify-center rounded-[13px]"
          >
            <Icon name="mail" />
          </span>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]">{t("tipTitle")}</b>
            <span className="text-muted text-sm leading-[1.5]">{t("tipText")}</span>
          </span>
        </div>
      }
    >
      <VerifyEmailForm />
    </AuthShell>
  );
}
