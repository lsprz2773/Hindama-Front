import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminSignInForm } from "@/features/auth/admin-sign-in-form";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/sign-in">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "AdminSignIn" });
  return { title: t("meta") };
}

export default async function AdminSignInPage({ params }: PageProps<"/[locale]/admin/sign-in">) {
  await resolveLocale(params);
  return <AdminSignInForm />;
}
