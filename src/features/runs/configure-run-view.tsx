"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BlockedAction } from "@/components/ui/state-view";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RiskConfirmation } from "@/components/ui/risk-confirmation";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { hasActiveRun, ProjectShell } from "@/features/projects/project-shell";
import { Link, useRouter } from "@/i18n/navigation";
import type { ModuleAvailability, Project } from "@/lib/api/schemas/projects";
import type { Schemas } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { createRun, useAfterRun } from "./api";
import { MODULE_VIEW, moduleFromKey } from "./modules";

type Module = Schemas["Module"];
type Missing = ModuleAvailability["missing"][number];
const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";

/** RF-47: topes y valores por defecto de `RunLimitsInput` en el contrato. */
const LIMITS = [
  { key: "rps", field: "requests_per_second", value: 5, max: 20 },
  { key: "concurrency", field: "concurrency", value: 2, max: 5 },
  { key: "total", field: "max_requests", value: 5000, max: 5000 },
  { key: "duration", field: "max_duration_minutes", value: 30, max: 30 },
] as const;

/** Dónde se resuelve cada requisito que falta (`ModuleAvailability.missing`, RF-45). */
const FIX: Record<Exclude<Missing, "not_implemented">, string> = {
  project_not_verified: "verification",
  no_contract: "contract",
  insufficient_identities: "identities/new",
  no_admin_identity: "identities/new",
  no_resources: "resources",
  policy_unconfirmed: "policy",
};

type Translate = ReturnType<typeof useTranslations<"ConfigureRun">>;

function startError(error: unknown, t: Translate) {
  if (error instanceof ApiError) {
    if (error.code === "project.active_run") return { title: t("errors.activeRun") };
    if (error.code === "project.not_verified") return { title: t("blocked.unverified") };
    if (error.code === "run.module_unavailable") return { title: t("errors.moduleUnavailable") };
    if (error.code === "run.risk_not_confirmed") return { title: t("confirmFirst") };
    if (error.status === 429) return { title: t("errors.rateLimited") };
    if (error.requestId)
      return { title: t("errors.failed"), text: t("errors.reference", { id: error.requestId }) };
  }
  return { title: t("errors.failed") };
}

function ConfigureRun({ project }: { project: Project }) {
  const t = useTranslations("ConfigureRun");
  const tm = useTranslations("Dashboard.modules");
  const router = useRouter();
  const toast = useToast();
  const http = useHttpClient();
  const afterRun = useAfterRun(project.id);
  const base = `/projects/${project.id}`;
  const available = project.modules.filter((m) => m.available).map((m) => m.module);
  const riskOf = (module: Module) => project.modules.find((m) => m.module === module)?.risk;

  // Desde el botón «Ejecutar» de un módulo del dashboard llega con ese módulo preseleccionado.
  const preselected = moduleFromKey(useSearchParams().get("module"));
  const [selected, setSelected] = useState<Module[]>(() =>
    preselected && available.includes(preselected)
      ? [preselected]
      : available.filter((m) => riskOf(m) === "low"),
  );
  const [confirmed, setConfirmed] = useState<Module[]>([]);
  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(LIMITS.map((l) => [l.key, String(l.value)])),
  );
  const [starting, setStarting] = useState(false);

  const riskModules = selected.filter((m) => riskOf(m) !== "low");
  const allConfirmed = riskModules.every((m) => confirmed.includes(m));
  const limitErrors = LIMITS.filter((l) => {
    const n = Number(limits[l.key]);
    return !Number.isInteger(n) || n < 1 || n > l.max;
  }).map((l) => l.key);
  const canRun = selected.length > 0 && allConfirmed && limitErrors.length === 0;

  const checks = [
    { ok: project.verification_status === "verified", text: t("checks.verified") },
    { ok: !hasActiveRun(project), text: t("checks.noActive") },
    { ok: project.base_url.startsWith("https:"), text: t("checks.https") },
    {
      ok: !project.modules.some((m) => m.missing.includes("policy_unconfirmed")),
      text: t("checks.policy"),
    },
  ];

  async function start() {
    if (!canRun || starting) return;
    setStarting(true);
    try {
      const run = await createRun(http, project.id, {
        modules: selected,
        limits: Object.fromEntries(LIMITS.map((l) => [l.field, Number(limits[l.key])])),
        confirm_risk: riskModules.length > 0 ? true : undefined,
      });
      afterRun(run);
      toast.show({ type: "info", title: t("started", { number: run.number }) });
      router.push(`${base}/runs/current`);
    } catch (error) {
      // Un requisito pudo cambiar: el proyecto se vuelve a pedir para pintar `missing`.
      if (error instanceof ApiError && error.code === "run.module_unavailable") afterRun();
      toast.show({ type: "error", ...startError(error, t) });
      setStarting(false);
    }
  }

  function toggle(module: Module) {
    setSelected((list) =>
      list.includes(module) ? list.filter((k) => k !== module) : [...list, module],
    );
    setConfirmed((list) => list.filter((k) => k !== module));
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <section aria-labelledby="run-modules" className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="run-modules" className="text-lg font-semibold">
                {t("modules.title")}
              </h2>
              <span className="text-muted text-sm">{t("modules.lead")}</span>
            </div>
            <span className="text-muted text-sm">
              {t("modules.selected", { count: selected.length })}
            </span>
          </div>
          <ul className="stagger m-0 flex list-none flex-col gap-2 p-0">
            {project.modules.map((m) => {
              const view = MODULE_VIEW[m.module];
              const blocked = !m.available;
              const reason = m.missing[0];
              const on = !blocked && selected.includes(m.module);
              const id = `run-module-${view.key}`;
              return (
                <li
                  key={m.module}
                  className={cn(
                    "bg-panel-2 flex flex-wrap items-center gap-3.5 rounded-[20px] border p-4",
                    on ? "border-accent/55" : "border-line",
                    blocked && "opacity-70",
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={on}
                    disabled={blocked || starting}
                    onChange={() => toggle(m.module)}
                    className="accent-accent size-[22px] flex-none"
                  />
                  <span
                    aria-hidden="true"
                    className="bg-progress-bg text-accent font-display inline-flex size-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold"
                  >
                    {view.code}
                  </span>
                  <label htmlFor={id} className="flex min-w-[200px] flex-1 cursor-pointer flex-col">
                    <span className="text-[15px] font-semibold">{tm(`names.${view.key}`)}</span>
                    <span className={cn("text-[13px]", blocked ? "text-warning" : "text-muted")}>
                      {blocked && reason
                        ? t(`modules.missing.${reason}`)
                        : t(`modules.notes.${view.key}`)}
                    </span>
                  </label>
                  {m.risk !== "low" ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12.5px] font-bold",
                        m.risk === "high"
                          ? "bg-danger-bg text-danger"
                          : "bg-warning-bg text-warning",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 rounded-full",
                          m.risk === "high" ? "bg-danger" : "bg-warning",
                        )}
                      />
                      {t(`risk.${m.risk}`)}
                    </span>
                  ) : null}
                  {blocked && reason && reason !== "not_implemented" ? (
                    <Link href={`${base}/${FIX[reason]}`} className="text-link text-sm font-bold">
                      {t(`modules.fix.${reason}`)}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <RiskConfirmation
          summary={t("riskSummary", {
            names: riskModules.map((m) => tm(`names.${MODULE_VIEW[m].key}`)).join(", "),
          })}
          modules={riskModules.map((m) => ({
            id: m,
            name: tm(`names.${MODULE_VIEW[m].key}`),
            level: t(`risk.${riskOf(m) === "high" ? "high" : "medium"}`).toLowerCase(),
          }))}
          confirmed={confirmed}
          onToggle={(id, on) =>
            setConfirmed((list) => (on ? [...list, id as Module] : list.filter((k) => k !== id)))
          }
        />

        <section aria-labelledby="run-limits" className={card}>
          <div className="flex flex-col gap-1">
            <h2 id="run-limits" className="text-lg font-semibold">
              {t("limits.title")}
            </h2>
            <span className="text-muted text-sm">{t("limits.lead")}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {LIMITS.map((l) => {
              const invalid = limitErrors.includes(l.key);
              return (
                <div key={l.key} className="flex flex-col gap-2">
                  <label htmlFor={`limit-${l.key}`} className="text-sm font-semibold">
                    {t(`limits.${l.key}`)}
                  </label>
                  <input
                    id={`limit-${l.key}`}
                    type="number"
                    min={1}
                    max={l.max}
                    value={limits[l.key]}
                    onChange={(e) => setLimits((v) => ({ ...v, [l.key]: e.target.value }))}
                    aria-invalid={invalid ? true : undefined}
                    aria-describedby={`limit-${l.key}-max`}
                    className={inputClass}
                  />
                  <span
                    id={`limit-${l.key}-max`}
                    className={cn("text-[13px]", invalid ? "text-fg" : "text-muted")}
                  >
                    {invalid
                      ? t("limits.outOfRange", { max: l.max })
                      : t("limits.max", { max: l.max.toLocaleString("en-US") })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="flex min-w-[280px] flex-[1_1_300px] flex-col gap-5">
        <section aria-labelledby="run-checks" className={card}>
          <h2 id="run-checks" className="text-lg font-semibold">
            {t("checks.title")}
          </h2>
          <ul className="stagger m-0 flex list-none flex-col gap-2.5 p-0">
            {checks.map((c) => (
              <li key={c.text} className="flex items-start gap-2.5 text-sm leading-[1.45]">
                <Icon
                  name={c.ok ? "check" : "alert"}
                  size={18}
                  strokeWidth={2.4}
                  className={cn("mt-0.5", c.ok ? "text-success" : "text-warning")}
                />
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
          <Button
            size="lg"
            block
            disabled={!canRun}
            loading={starting}
            onClick={() => void start()}
          >
            {starting ? (
              t("starting")
            ) : (
              <>
                <Icon name="play" size={16} />
                {t("run", { count: selected.length })}
              </>
            )}
          </Button>
          {!allConfirmed ? (
            <span className="text-muted text-[13px]">{t("confirmFirst")}</span>
          ) : null}
        </section>
        <section aria-labelledby="run-readonly" className={card}>
          <h2 id="run-readonly" className="text-lg font-semibold">
            {t("readOnly.title")}
          </h2>
          <p className="text-muted text-sm leading-[1.55]">{t("readOnly.text")}</p>
        </section>
      </aside>
    </div>
  );
}

/** V-25. Configurar una ejecución: módulos, confirmación de los de riesgo y límites (RF-44 a RF-49, RN-05). */
export function ConfigureRunView({ id }: { id: string }) {
  const t = useTranslations("ConfigureRun");
  return (
    <ProjectShell
      id={id}
      trail={[{ label: t("crumbRuns"), href: `/projects/${id}` }, { label: t("crumb") }]}
      title={t("title")}
      render={(project) =>
        project.verification_status !== "verified" ? (
          <BlockedAction
            label={t("run", { count: 0 })}
            reason={t("blocked.unverified")}
            linkLabel={t("blocked.goVerify")}
            href={`/projects/${id}/verification`}
          />
        ) : hasActiveRun(project) ? (
          <BlockedAction
            label={t("run", { count: 0 })}
            reason={t("blocked.active")}
            linkLabel={t("blocked.viewRun")}
            href={`/projects/${id}/runs/current`}
          />
        ) : (
          <Suspense>
            <ConfigureRun key={project.id} project={project} />
          </Suspense>
        )
      }
    />
  );
}
