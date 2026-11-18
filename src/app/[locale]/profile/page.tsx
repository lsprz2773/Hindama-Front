import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileView } from "@/features/account/profile-view";
import { SESSION_STUB } from "@/features/account/service";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/profile">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Profile" });
  return { title: t("title") };
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Profile" });
  return (
    <AppShell role="analyst" userName={SESSION_STUB.name} title={t("title")}>
      <ProfileView />
    </AppShell>
  );
}
