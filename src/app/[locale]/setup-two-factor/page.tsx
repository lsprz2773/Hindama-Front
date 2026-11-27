import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { TwoFactorSetup } from "@/features/account/two-factor-setup";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/setup-two-factor">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "TwoFactorSetup" });
  return { title: t("mandatoryHeading") };
}

export default async function MandatoryTwoFactorPage({
  params,
}: PageProps<"/[locale]/setup-two-factor">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "TwoFactorSetup" });
  return (
    <AppShell
      role="admin"
      title={t("mandatoryHeading")}
      breadcrumb={[{ label: t("adminCrumb") }, { label: t("crumb") }]}
    >
      <TwoFactorSetup mandatory />
    </AppShell>
  );
}
