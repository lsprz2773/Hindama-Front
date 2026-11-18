import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SecondFactorForm } from "@/features/auth/second-factor-form";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/sign-in/two-factor">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "SecondFactor" });
  return { title: t("metaAdmin") };
}

export default async function AdminSecondFactorPage({
  params,
}: PageProps<"/[locale]/admin/sign-in/two-factor">) {
  await resolveLocale(params);
  return <SecondFactorForm admin />;
}
