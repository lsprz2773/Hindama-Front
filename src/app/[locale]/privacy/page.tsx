import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "@/features/legal/legal-document";
import { resolveLocale } from "@/i18n/params";

const SECTIONS = [
  "data",
  "purpose",
  "credentials",
  "retention",
  "audit",
  "rights",
  "changes",
] as const;
const RETENTION = ["database", "backups", "audit"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return { title: t("title") };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Privacy" });

  return (
    <LegalDocument
      title={t("title")}
      lead={t("lead")}
      badge={t("badge")}
      tocLabel={t("tocLabel")}
      tocHeading={t("tocHeading")}
      retention={{
        label: t("retentionLabel"),
        items: RETENTION.map((key) => ({
          where: t(`retention.${key}.where`),
          term: t(`retention.${key}.term`),
        })),
      }}
      sections={SECTIONS.map((key, i) => ({
        id: `s${i + 1}`,
        title: t(`sections.${key}.title`),
        text: t(`sections.${key}.text`),
      }))}
    />
  );
}
