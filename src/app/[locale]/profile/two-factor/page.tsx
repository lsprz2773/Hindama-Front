import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { TwoFactorSetup } from "@/features/account/two-factor-setup";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/profile/two-factor">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "TwoFactorSetup" });
  return { title: t("title") };
}

export default async function EnableTwoFactorPage({
  params,
}: PageProps<"/[locale]/profile/two-factor">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "TwoFactorSetup" });
  const profile = await getTranslations({ locale, namespace: "Profile" });
  return (
    <AppShell
      role="analyst"
      title={t("title")}
      breadcrumb={[{ label: profile("title"), href: "/profile" }, { label: t("crumb") }]}
    >
      <TwoFactorSetup />
    </AppShell>
  );
}
