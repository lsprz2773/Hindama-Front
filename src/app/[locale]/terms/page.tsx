import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "@/features/legal/legal-document";
import { TermsVersionBadge } from "@/features/legal/terms-version";
import { resolveLocale } from "@/i18n/params";

const SECTIONS = [
  "service",
  "responsible",
  "ownership",
  "limits",
  "activity",
  "suspension",
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Terms" });
  return { title: t("title") };
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Terms" });

  return (
    <LegalDocument
      title={t("title")}
      lead={t("lead")}
      badge={<TermsVersionBadge />}
      tocLabel={t("tocLabel")}
      tocHeading={t("tocHeading")}
      note={{ title: t("noteTitle"), text: t("noteText") }}
      sections={SECTIONS.map((key, i) => ({
        id: `s${i + 1}`,
        title: t(`sections.${key}.title`),
        text: t(`sections.${key}.text`),
      }))}
    />
  );
}
