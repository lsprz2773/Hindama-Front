import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicShell } from "@/components/layout/public-shell";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { SeverityBadge } from "@/components/ui/severity";
import { resolveLocale } from "@/i18n/params";

const BENEFITS = [
  { key: "early", icon: "clock" },
  { key: "contract", icon: "file" },
  { key: "evidence", icon: "list" },
  { key: "followUp", icon: "refresh" },
] as const satisfies readonly { key: string; icon: IconName }[];
const MODULES = [
  { key: "auth", code: "API2" },
  { key: "config", code: "API8" },
  { key: "objects", code: "API1" },
  { key: "functions", code: "API5" },
  { key: "properties", code: "API3" },
  { key: "resources", code: "API4" },
  { key: "sql", code: "SQL" },
] as const;
const STEPS = ["detect", "fix", "retest", "close"] as const;
const CYCLE = [
  { key: "detected", n: 15 },
  { key: "resolved", n: 6 },
  { key: "regressions", n: 2 },
] as const;

const cardClass = "border-line bg-panel rounded-[28px] border backdrop-blur-lg";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Home" });
  return { title: { absolute: t("meta") } };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <PublicShell>
      <section
        aria-labelledby="hero-h"
        className="border-line flex flex-wrap items-center gap-10 rounded-[28px] border bg-[image:var(--hero)] px-6 py-10 sm:px-12 sm:py-14"
      >
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
          <span className="border-line bg-panel-2 inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[13px] font-semibold">
            <Icon name="info" size={14} strokeWidth={2.4} className="text-accent" />
            {t("badge")}
          </span>
          <h1
            id="hero-h"
            className="font-display max-w-[15ch] text-[44px] leading-[0.98] font-medium tracking-[-0.045em] sm:text-[60px] lg:text-[76px]"
          >
            {t("title")}
          </h1>
          <p className="text-muted max-w-[52ch] text-lg leading-[1.55]">{t("lead")}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/sign-up" size="xl" className="px-[30px]">
              {t("ctaPrimary")}
            </ButtonLink>
            <ButtonLink href="#modules" variant="secondary" size="xl">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>
        </div>

        <figure className="m-0 flex min-w-0 flex-[1_1_360px] flex-col gap-3">
          <div className="border-line bg-panel-2 flex flex-col gap-2.5 rounded-[22px] border px-[22px] py-5 backdrop-blur-lg">
            <div className="flex flex-wrap items-center gap-2.5">
              <SeverityBadge severity="critical" />
              <span className="text-muted text-[13px]">API1 · CWE-639</span>
            </div>
            <b className="text-[17px]">{t("example.title")}</b>
            <code className="bg-track rounded-xl px-3 py-2.5 font-mono text-[13px]">
              {t("example.request")}
            </code>
            <span className="text-muted text-[13.5px]">{t("example.advice")}</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {CYCLE.map(({ key, n }) => (
              <div
                key={key}
                className="border-line bg-panel-2 flex flex-col gap-0.5 rounded-[20px] border px-4 py-3.5"
              >
                <span className="font-display text-[26px] leading-none font-medium tracking-[-0.03em]">
                  {n}
                </span>
                <span className="text-muted text-[12.5px]">{t(`cycle.${key}`)}</span>
              </div>
            ))}
          </div>
          <figcaption className="text-muted text-[12.5px]">{t("example.caption")}</figcaption>
        </figure>
      </section>

      <section aria-labelledby="benefits-h" className="flex flex-col gap-4 px-2 py-3">
        <h2 id="benefits-h" className="font-display text-4xl font-medium tracking-[-0.025em]">
          {t("benefits.title")}
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 p-0">
          {BENEFITS.map(({ key, icon }) => (
            <li key={key} className={`${cardClass} flex flex-col gap-2.5 p-6`}>
              <span
                aria-hidden="true"
                className="bg-progress-bg text-accent inline-flex size-11 items-center justify-center rounded-[14px]"
              >
                <Icon name={icon} size={22} />
              </span>
              <b className="text-[17px]">{t(`benefits.${key}.title`)}</b>
              <span className="text-muted text-[14.5px] leading-[1.55]">
                {t(`benefits.${key}.text`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="modules"
        aria-labelledby="modules-h"
        className={`${cardClass} flex scroll-mt-6 flex-col gap-5 p-6 sm:p-8`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="modules-h" className="font-display text-4xl font-medium tracking-[-0.025em]">
            {t("modules.title")}
          </h2>
          <span className="text-muted text-[14.5px]">{t("modules.subtitle")}</span>
        </div>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-2.5 p-0">
          {MODULES.map(({ key, code }) => (
            <li
              key={key}
              className="border-line bg-panel-2 flex items-start gap-3.5 rounded-[20px] border p-4"
            >
              <span
                aria-hidden="true"
                className="bg-progress-bg text-accent font-display inline-flex size-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold"
              >
                {code}
              </span>
              <span className="flex flex-col gap-0.5">
                <b className="text-[15px]">{t(`modules.${key}.name`)}</b>
                <span className="text-muted text-[13.5px] leading-[1.45]">
                  {t(`modules.${key}.text`)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cycle-h" className="flex flex-col gap-4 px-2 py-3">
        <h2 id="cycle-h" className="font-display text-4xl font-medium tracking-[-0.025em]">
          {t("steps.title")}
        </h2>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 p-0">
          {STEPS.map((key, index) => (
            <li key={key} className={`${cardClass} flex flex-col gap-2 p-6`}>
              <span
                aria-hidden="true"
                className="font-display text-accent text-[40px] leading-none font-medium"
              >
                {index + 1}
              </span>
              <b className="text-[17px]">{t(`steps.${key}.title`)}</b>
              <span className="text-muted text-[14.5px] leading-[1.55]">
                {t(`steps.${key}.text`)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div
        role="note"
        className="border-line bg-panel-2 border-l-accent flex items-start gap-3 rounded-[18px] border border-l-4 px-4 py-3.5"
      >
        <Icon name="lock" className="text-accent" />
        <div className="flex min-w-0 flex-col gap-1">
          <b className="text-sm">{t("responsible.title")}</b>
          <span className="text-muted text-sm leading-[1.5]">{t("responsible.text")}</span>
        </div>
      </div>
    </PublicShell>
  );
}
