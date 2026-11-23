import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { RedirectIfSignedIn } from "@/features/auth/redirect-if-signed-in";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "SignUp" });
  return { title: t("meta") };
}

const STEPS = ["one", "two", "three", "four"] as const;

export default async function SignUpPage({ params }: PageProps<"/[locale]/sign-up">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "SignUp" });

  return (
    <AuthShell
      title={t("heroTitle")}
      lead={t("heroLead")}
      aside={
        <ol className="m-0 grid max-w-[560px] list-none grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5 p-0">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="border-line bg-panel-2 flex items-start gap-3.5 rounded-[20px] border px-[18px] py-4 backdrop-blur-lg"
            >
              <span
                aria-hidden="true"
                className="font-display text-accent text-[22px] leading-none font-medium"
              >
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <b className="text-[15px]">{t(`steps.${step}.title`)}</b>
                <span className="text-muted text-[13px]">{t(`steps.${step}.text`)}</span>
              </span>
            </li>
          ))}
        </ol>
      }
    >
      <RedirectIfSignedIn />
      <SignUpForm />
    </AuthShell>
  );
}
