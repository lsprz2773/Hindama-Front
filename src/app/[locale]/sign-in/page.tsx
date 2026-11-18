import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { SeverityBadge } from "@/components/ui/severity";
import { resolveLocale } from "@/i18n/params";
import { SignInForm } from "@/features/auth/sign-in-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "SignIn" });
  return { title: t("meta") };
}

export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "SignIn" });

  return (
    <AuthShell
      title={t("heroTitle")}
      lead={t("heroLead")}
      aside={
        <figure className="border-line bg-panel-2 m-0 flex max-w-[520px] flex-col gap-2.5 rounded-[22px] border px-5 py-[18px] backdrop-blur-lg">
          <div className="flex flex-wrap items-center gap-3">
            <SeverityBadge severity="critical" />
            <span className="text-muted text-[13px]">{t("exampleCategory")}</span>
          </div>
          <span className="text-base font-semibold">{t("exampleTitle")}</span>
          <code className="text-muted font-mono text-[13px]">{t("exampleRequest")}</code>
          <figcaption className="text-muted text-[12.5px]">{t("exampleCaption")}</figcaption>
        </figure>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
