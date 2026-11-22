"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "radix-ui";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { TERMS_KEY, writeFlag } from "@/features/account/browser-store";
import { Link, useRouter } from "@/i18n/navigation";

export const TERMS_VERSION = "2026-10-30";

const RULES: { key: "authorized" | "ownership" | "testEnv" | "logged"; icon: IconName }[] = [
  { key: "authorized", icon: "lock" },
  { key: "ownership", icon: "shield" },
  { key: "testEnv", icon: "alert" },
  { key: "logged", icon: "list" },
];

/** V-14. Aceptación de los términos de uso responsable antes del primer proyecto (RF-16, RN-12). */
export function AcceptTermsView() {
  const t = useTranslations("AcceptTerms");
  const router = useRouter();
  const toast = useToast();
  const [accepted, setAccepted] = useState(false);

  function accept() {
    writeFlag(TERMS_KEY, TERMS_VERSION);
    toast.show({ type: "success", title: t("accepted") });
    router.push("/projects/new");
  }

  return (
    <section
      aria-labelledby="terms-h"
      className="border-line flex max-w-[860px] flex-col gap-[22px] rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-9"
    >
      <div className="flex flex-col gap-2">
        <h2 id="terms-h" className="font-display text-[32px] font-medium tracking-[-0.025em]">
          {t("title")}
        </h2>
        <p className="text-muted text-base leading-[1.55]">
          {t("lead", { version: TERMS_VERSION })}
        </p>
      </div>

      <ul className="stagger m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3 p-0">
        {RULES.map(({ key, icon }) => (
          <li
            key={key}
            className="border-line bg-panel-2 flex gap-3.5 rounded-[20px] border p-[18px] backdrop-blur-lg"
          >
            <span
              aria-hidden="true"
              className="bg-progress-bg text-accent inline-flex size-10 flex-none items-center justify-center rounded-[13px]"
            >
              <Icon name={icon} />
            </span>
            <span className="flex flex-col gap-1">
              <b className="text-[15px]">{t(`rules.${key}.title`)}</b>
              <span className="text-muted text-sm leading-[1.5]">{t(`rules.${key}.text`)}</span>
            </span>
          </li>
        ))}
      </ul>

      <Link href="/terms" className="text-link text-[15px] font-bold">
        {t("readFull")}
      </Link>

      <label className="border-line bg-panel-2 flex cursor-pointer items-start gap-3.5 rounded-[20px] border px-5 py-[18px]">
        <Checkbox.Root
          checked={accepted}
          onCheckedChange={(value) => setAccepted(value === true)}
          className="border-line-strong data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-on-accent inline-flex size-[26px] flex-none cursor-pointer items-center justify-center rounded-lg border-2"
        >
          <Checkbox.Indicator>
            <Icon name="check" size={15} strokeWidth={3} />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <span className="text-[15px] leading-[1.5]">{t("accept")}</span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted text-[13.5px]">{t("recorded")}</span>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/projects" variant="secondary">
            {t("cancel")}
          </ButtonLink>
          <Button disabled={!accepted} onClick={accept}>
            {t("continue")}
          </Button>
        </div>
      </div>
    </section>
  );
}
