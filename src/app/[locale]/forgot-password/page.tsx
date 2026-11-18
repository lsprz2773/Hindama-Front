import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordFlow } from "@/features/auth/forgot-password-flow";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/forgot-password">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "ForgotPassword" });
  return { title: t("meta") };
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  await resolveLocale(params);
  return <ForgotPasswordFlow />;
}
