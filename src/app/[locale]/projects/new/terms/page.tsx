import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { SESSION_STUB } from "@/features/account/service";
import { AcceptTermsView } from "@/features/projects/accept-terms-view";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/new/terms">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "AcceptTerms" });
  return { title: t("pageTitle") };
}

export default async function AcceptTermsPage({
  params,
}: PageProps<"/[locale]/projects/new/terms">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "AcceptTerms" });
  const p = await getTranslations({ locale, namespace: "Projects" });
  return (
    <AppShell
      role="analyst"
      userName={SESSION_STUB.name}
      title={t("pageTitle")}
      breadcrumb={[{ label: p("title"), href: "/projects" }, { label: p("newProject") }]}
    >
      <AcceptTermsView />
    </AppShell>
  );
}
