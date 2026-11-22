"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { Button, ButtonLink } from "@/components/ui/button";
import { HelpPanel } from "@/components/ui/help-panel";
import { Icon } from "@/components/ui/icon";
import { inputClass, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/features/account/api";
import { useRouter } from "@/i18n/navigation";
import { projectCreateSchema } from "@/lib/api/schemas/projects";
import { fieldErrors } from "@/lib/api/zod";
import { cn } from "@/lib/cn";
import { ApiError, type ApiWarning } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { checkBaseUrl } from "@/lib/url";
import { createProject, useRefreshProjects } from "./api";

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
  const http = useHttpClient();
  const refresh = useRefreshProjects();
  const me = useMe();
  const termsRequired = me.data?.terms.acceptance_required === true;

  // Sin aceptar los términos vigentes no se puede crear un proyecto (RF-16, RN-12).
  useEffect(() => {
    if (termsRequired) router.replace("/projects/new/terms");
  }, [termsRequired, router]);

  const [step, setStep] = useState<WizardStep>("data");
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [errors, setErrors] = useState<{ name?: string; description?: string; url?: string }>({});
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const [pending, setPending] = useState(false);

  const check = baseUrl.trim() ? checkBaseUrl(baseUrl) : null;
  const insecure = check?.ok === true && check.insecure;
  const stepIndex = WIZARD_STEPS.indexOf(step);

  /** Texto de un código de error de campo (los mismos que devuelve la API). */
  function fieldMessage(field: "name" | "description" | "url", code: string | undefined) {
    if (!code) return undefined;
    if (field === "url") {
      if (code === "validation.required") return t("errors.urlRequired");
      if (code === "url.scheme_not_allowed") return t("errors.url.protocol");
      if (code === "url.destination_not_allowed") return t("errors.url.destination");
      return t("errors.url.invalid");
    }
    if (field === "name") {
      return code === "validation.required" ? t("errors.nameRequired") : t("errors.nameInvalid");
    }
    return t("errors.descriptionInvalid");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = projectCreateSchema.safeParse({ name, description, base_url: baseUrl });
    const local = parsed.success ? {} : fieldErrors(parsed.error);
    const next: typeof errors = {
      name: fieldMessage("name", local.name?.[0]),
      description: fieldMessage("description", local.description?.[0]),
      url: fieldMessage("url", local.base_url?.[0]),
    };
    // Ayuda en el navegador para redes privadas o locales; la API es la que decide (RF-11).
    if (!next.url && check && !check.ok) next.url = t(`errors.url.${check.problem}`);
    setErrors(next);
    if (next.name || next.description || next.url || !parsed.success) return;

    setPending(true);
    try {
      const result = await createProject(http, parsed.data);
      setProjectId(result.data.id);
      setWarnings(result.data.warnings);
      await refresh.projects();
      setStep("contract");
      toast.show({ type: "success", title: t("created", { name: result.data.name }) });
    } catch (e) {
      if (e instanceof ApiError && e.code === "terms.not_accepted") {
        router.replace("/projects/new/terms");
      } else if (e instanceof ApiError && e.kind === "validation" && e.fields) {
        setErrors({
          name: fieldMessage("name", e.fieldCode("name")),
          description: fieldMessage("description", e.fieldCode("description")),
          url: fieldMessage("url", e.fieldCode("base_url")),
        });
      } else
        toast.show({
          type: "error",
          title: t("errors.networkTitle"),
          text:
            e instanceof ApiError && e.status === 429
              ? t("errors.rateLimited")
              : e instanceof ApiError && e.requestId
                ? t("errors.reference", { id: e.requestId })
                : t("errors.networkText"),
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
            className="animate-fade-in border-line bg-panel flex min-w-0 flex-[999_1_520px] flex-col gap-[22px] rounded-[28px] border p-6 backdrop-blur-lg sm:p-8"
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
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={errors.description ? "project-description-error" : undefined}
                className={cn(inputClass, "py-3.5 leading-[1.5]")}
              />
              {errors.description ? (
                <p id="project-description-error" role="alert" className="text-danger text-sm">
                  {errors.description}
                </p>
              ) : null}
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
            key={step}
            aria-labelledby="wizard-step-h"
            className="animate-fade-in border-line bg-panel flex min-w-0 flex-[999_1_520px] flex-col gap-5 rounded-[28px] border p-6 backdrop-blur-lg sm:p-8"
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
            {step === "contract" && warnings.length > 0 ? (
              <ApiWarnings warnings={warnings} />
            ) : null}
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
            <ul className="stagger !mt-3 !list-none !pl-0">
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
