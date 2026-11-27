"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "radix-ui";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useQueryClient } from "@tanstack/react-query";
import { FormSkeleton } from "@/components/skeletons/page-skeletons";
import { QueryState } from "@/components/ui/query-state";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/features/account/api";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { ME_KEY } from "@/lib/query/provider";
import { acceptTerms } from "./api";

const RULES: { key: "authorized" | "ownership" | "testEnv" | "logged"; icon: IconName }[] = [
  { key: "authorized", icon: "lock" },
  { key: "ownership", icon: "shield" },
  { key: "testEnv", icon: "alert" },
  { key: "logged", icon: "list" },
];

/**
 * V-14. Aceptación de los términos de uso responsable antes del primer proyecto (RF-16, RN-12).
 * La versión vigente la informa `getMe`; la aceptación se registra con `acceptTerms`.
 */
export function AcceptTermsView() {
  const t = useTranslations("AcceptTerms");
  const me = useMe();
  return (
    <QueryState query={me} subject={t("subject")} skeleton={<FormSkeleton label={t("loading")} />}>
      {(data) => <AcceptTermsForm version={data.terms.current_version} />}
    </QueryState>
  );
}

function AcceptTermsForm({ version }: { version: string }) {
  const t = useTranslations("AcceptTerms");
  const router = useRouter();
  const toast = useToast();
  const http = useHttpClient();
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);

  async function accept() {
    if (pending || !accepted) return;
    setPending(true);
    try {
      const result = await acceptTerms(http, version);
      queryClient.setQueryData(ME_KEY, result.data);
      toast.show({ type: "success", title: t("accepted") });
      router.push("/projects/new");
    } catch (e) {
      setPending(false);
      if (e instanceof ApiError && e.code === "terms.outdated_version") {
        // Se publicó otra versión mientras leía: se vuelve a mostrar la vigente.
        setAccepted(false);
        await queryClient.invalidateQueries({ queryKey: ME_KEY });
        toast.show({ type: "warning", title: t("outdated") });
      } else {
        toast.show({
          type: "error",
          title: t("errorTitle"),
          text:
            e instanceof ApiError && e.status === 429
              ? t("rateLimited")
              : e instanceof ApiError && e.requestId
                ? t("reference", { id: e.requestId })
                : t("errorText"),
          action: { label: t("retry"), onClick: () => void accept() },
        });
      }
    }
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
        <p className="text-muted text-base leading-[1.55]">{t("lead", { version })}</p>
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
          <Button disabled={!accepted} loading={pending} onClick={() => void accept()}>
            {t("continue")}
          </Button>
        </div>
      </div>
    </section>
  );
}
