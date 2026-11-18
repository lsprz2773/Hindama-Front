"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { Button, ButtonLink } from "@/components/ui/button";
import { HelpPanel } from "@/components/ui/help-panel";
import { Icon } from "@/components/ui/icon";
import { inputClass, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { TERMS_KEY, useFlag, useIsClient } from "@/features/account/browser-store";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { checkBaseUrl } from "@/lib/url";
import { createProject } from "./store";

const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;
const WIZARD_STEPS = ["data", "contract", "verification", "done"] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];
const PROHIBITED = [
  ["private", "10.0.0.0/8, 192.168.x.x"],
  ["loopback", "127.0.0.1, localhost"],
  ["linkLocal", "169.254.x.x"],
  ["metadata", "169.254.169.254"],
] as const;

/**
 * V-15. Asistente de creación de proyecto en cuatro pasos (datos, contrato, verificación y listo).
 * Los pasos 2 y 3 se pueden omitir y quedan pendientes en el dashboard (punto 4).
 */
export function NewProjectView() {
  const t = useTranslations("NewProject");
  const router = useRouter();
  const toast = useToast();
  const isClient = useIsClient();
  const termsAccepted = useFlag(TERMS_KEY);

  // Sin aceptar los términos de uso responsable no se puede crear el primer proyecto (RF-16).
  useEffect(() => {
    if (isClient && termsAccepted === null) router.replace("/projects/new/terms");
  }, [isClient, termsAccepted, router]);

  const [step, setStep] = useState<WizardStep>("data");
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [pending, setPending] = useState(false);

  const check = baseUrl.trim() ? checkBaseUrl(baseUrl) : null;
  const insecure = check?.ok === true && check.insecure;
  const stepIndex = WIZARD_STEPS.indexOf(step);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("errors.nameRequired");
    if (!baseUrl.trim()) next.url = t("errors.urlRequired");
    else if (check && !check.ok) next.url = t(`errors.url.${check.problem}`);
    setErrors(next);
    if (next.name || next.url) return;

    setPending(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600)); // TODO(api): crear el proyecto
      const project = createProject({
        name: name.trim(),
        description: description.trim(),
        baseUrl: baseUrl.trim(),
      });
      setProjectId(project.id);
      setStep("contract");
      toast.show({ type: "success", title: t("created", { name: project.name }) });
    } catch (e) {
      if (e instanceof ApiError && e.kind === "conflict")
        setErrors({ name: t("errors.nameTaken") });
      else
        toast.show({
          type: "error",
          title: t("errors.networkTitle"),
          text: t("errors.networkText"),
          action: { label: t("errors.retry"), onClick: () => void onSubmit(event) },
        });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ol
        aria-label={t("stepsLabel")}
        className="border-line bg-panel m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 rounded-3xl border p-2"
      >
        {WIZARD_STEPS.map((key, index) => {
          const current = index === stepIndex;
          const done = index < stepIndex;
          return (
            <li
              key={key}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[18px] px-3.5 py-3",
                current ? "bg-panel-2 text-fg" : "text-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-8 flex-none items-center justify-center rounded-full text-sm font-bold",
                  done
                    ? "bg-success text-on-accent"
                    : current
                      ? "bg-accent text-on-accent"
                      : "bg-track",
                )}
              >
                {done ? <Icon name="check" size={16} strokeWidth={3} /> : index + 1}
              </span>
              <span className="flex flex-col">
                <b className="text-sm">{t(`steps.${key}.title`)}</b>
                <span className="text-[12.5px] opacity-80">{t(`steps.${key}.note`)}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-start gap-5">
        {step === "data" ? (
          <form
            noValidate
            onSubmit={onSubmit}
            className="border-line bg-panel flex min-w-0 flex-[999_1_520px] flex-col gap-[22px] rounded-[28px] border p-6 backdrop-blur-lg sm:p-8"
          >
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-[28px] font-medium tracking-[-0.02em]">
                {t("form.title")}
              </h2>
              <p className="text-muted text-[15px]">{t("form.lead")}</p>
            </div>

            <div className="flex flex-col gap-2">
              <TextField
                label={t("form.name")}
                value={name}
                maxLength={MAX_NAME}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                labelAside={
                  <span className="text-muted text-[13px] tabular-nums">
                    {name.length} / {MAX_NAME}
                  </span>
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-3">
                <label htmlFor="project-description" className="text-sm font-semibold">
                  {t("form.description")}{" "}
                  <span className="text-muted font-normal">{t("form.optional")}</span>
                </label>
                <span className="text-muted text-[13px] tabular-nums">
                  {description.length} / {MAX_DESCRIPTION}
                </span>
              </div>
              <textarea
                id="project-description"
                rows={3}
                maxLength={MAX_DESCRIPTION}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={cn(inputClass, "py-3.5 leading-[1.5]")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <TextField
                label={t("form.url")}
                type="url"
                inputMode="url"
                placeholder="https://api.ejemplo.mx"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                error={errors.url}
                hint={t("form.urlHint")}
                className={cn("font-mono text-[15px]", insecure && "border-warning")}
              />
            </div>
            {insecure ? <ApiWarnings warnings={[{ code: "url.no_tls" }]} /> : null}

            <div className="border-line flex flex-wrap justify-end gap-3 border-t pt-1.5">
              <ButtonLink href="/projects" variant="secondary">
                {t("form.cancel")}
              </ButtonLink>
              <Button type="submit" loading={pending}>
                {pending ? t("form.creating") : t("form.submit")}
              </Button>
            </div>
          </form>
        ) : (
          <section
            aria-labelledby="wizard-step-h"
            className="border-line bg-panel flex min-w-0 flex-[999_1_520px] flex-col gap-5 rounded-[28px] border p-6 backdrop-blur-lg sm:p-8"
          >
            <h2
              id="wizard-step-h"
              className="font-display text-[28px] font-medium tracking-[-0.02em]"
            >
              {t(`panels.${step}.title`)}
            </h2>
            <p className="text-muted max-w-[60ch] text-[15px] leading-[1.55]">
              {t(`panels.${step}.text`)}
            </p>
            <div className="flex flex-wrap gap-3">
              {step === "done" ? (
                <ButtonLink href={`/projects/${projectId}`}>{t("panels.done.action")}</ButtonLink>
              ) : (
                <>
                  <ButtonLink
                    href={`/projects/${projectId}/${step === "contract" ? "contract" : "verification"}`}
                  >
                    {t(`panels.${step}.action`)}
                  </ButtonLink>
                  <Button
                    variant="secondary"
                    onClick={() => setStep(step === "contract" ? "verification" : "done")}
                  >
                    {t("skip")}
                  </Button>
                </>
              )}
            </div>
          </section>
        )}

        <div className="flex min-w-[260px] flex-[1_1_300px] flex-col gap-5">
          <HelpPanel title={t("help.urlTitle")}>
            <p>{t("help.urlText")}</p>
            <ul className="!mt-3 !list-none !pl-0">
              {PROHIBITED.map(([key, example]) => (
                <li key={key} className="flex items-baseline gap-2.5">
                  <span aria-hidden="true" className="text-danger font-bold">
                    ×
                  </span>
                  <span>
                    {t(`help.prohibited.${key}`)}{" "}
                    <code className="text-muted font-mono text-[12.5px]">{example}</code>
                  </span>
                </li>
              ))}
            </ul>
          </HelpPanel>
          <HelpPanel title={t("help.nextTitle")}>
            <p>{t("help.nextText")}</p>
          </HelpPanel>
        </div>
      </div>
    </>
  );
}
