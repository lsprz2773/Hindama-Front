"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { BlockedAction } from "@/components/ui/state-view";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RiskConfirmation } from "@/components/ui/risk-confirmation";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useIdentities } from "@/features/config/identities";
import { ProjectShell } from "@/features/projects/project-shell";
import { updateProject, type Project } from "@/features/projects/store";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { RUN_LIMITS, RUN_MODULES, type ModuleKey } from "./data";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";

function ConfigureRun({ project }: { project: Project }) {
  const t = useTranslations("ConfigureRun");
  const tm = useTranslations("Dashboard.modules");
  const router = useRouter();
  const toast = useToast();
  const { identities } = useIdentities(project.id);
  const hasAdmin = identities.some((i) => i.role === "admin");
  const base = `/projects/${project.id}`;

  const [selected, setSelected] = useState<ModuleKey[]>(
    RUN_MODULES.filter((m) => m.defaultOn).map((m) => m.key),
  );
  const [confirmed, setConfirmed] = useState<ModuleKey[]>([]);
  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(RUN_LIMITS.map((l) => [l.key, String(l.value)])),
  );
  const [starting, setStarting] = useState(false);

  const riskModules = RUN_MODULES.filter((m) => m.risk && selected.includes(m.key));
  const allConfirmed = riskModules.every((m) => confirmed.includes(m.key));
  const limitErrors = RUN_LIMITS.filter((l) => {
    const n = Number(limits[l.key]);
    return !Number.isInteger(n) || n < 1 || n > l.max;
  }).map((l) => l.key);
  const canRun = selected.length > 0 && allConfirmed && limitErrors.length === 0;

  const checks = [
    { ok: true, text: t("checks.verified") },
    { ok: project.running === undefined, text: t("checks.noActive") },
    { ok: !project.baseUrl.startsWith("http:"), text: t("checks.https") },
    {
      ok: !project.policy || project.policy.confirmed === project.policy.total,
      text: t("checks.policy"),
    },
  ];

  async function start() {
    if (!canRun || starting) return;
    setStarting(true);
    await new Promise((resolve) => setTimeout(resolve, 600)); // TODO(api): crear la ejecución
    updateProject(project.id, { running: 0 });
    toast.show({ type: "info", title: t("started") });
    router.push(`${base}/runs/current`);
  }

  function toggle(key: ModuleKey) {
    setSelected((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
    setConfirmed((list) => list.filter((k) => k !== key));
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
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {RUN_MODULES.map((m) => {
              const blocked = m.blockedNoAdmin && !hasAdmin;
              const on = !blocked && selected.includes(m.key);
              const id = `run-module-${m.key}`;
              return (
                <li
                  key={m.key}
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
                    disabled={blocked}
                    onChange={() => toggle(m.key)}
                    className="accent-accent size-[22px] flex-none"
                  />
                  <span
                    aria-hidden="true"
                    className="bg-progress-bg text-accent font-display inline-flex size-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold"
                  >
                    {m.code}
                  </span>
                  <label htmlFor={id} className="flex min-w-[200px] flex-1 cursor-pointer flex-col">
                    <span className="text-[15px] font-semibold">{tm(`names.${m.key}`)}</span>
                    <span className={cn("text-[13px]", blocked ? "text-warning" : "text-muted")}>
                      {blocked ? t("modules.noAdmin") : t(`modules.notes.${m.key}`)}
                    </span>
                  </label>
                  {m.risk ? (
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
                  {blocked ? (
                    <Link href={`${base}/identities/new`} className="text-link text-sm font-bold">
                      {t("modules.addIdentity")}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <RiskConfirmation
          summary={t("riskSummary", {
            names: riskModules.map((m) => tm(`names.${m.key}`)).join(", "),
          })}
          modules={riskModules.map((m) => ({
            id: m.key,
            name: tm(`names.${m.key}`),
            level: t(`risk.${m.risk ?? "medium"}`).toLowerCase(),
          }))}
          confirmed={confirmed}
          onToggle={(id, on) =>
            setConfirmed((list) => (on ? [...list, id as ModuleKey] : list.filter((k) => k !== id)))
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
            {RUN_LIMITS.map((l) => {
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
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
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
    >
      {(project) =>
        !project.verified ? (
          <BlockedAction
            label={t("run", { count: 0 })}
            reason={t("blocked.unverified")}
            linkLabel={t("blocked.goVerify")}
            href={`/projects/${id}/verification`}
          />
        ) : project.running !== undefined ? (
          <BlockedAction
            label={t("run", { count: 0 })}
            reason={t("blocked.active")}
            linkLabel={t("blocked.viewRun")}
            href={`/projects/${id}/runs/current`}
          />
        ) : (
          <ConfigureRun key={project.id} project={project} />
        )
      }
    </ProjectShell>
  );
}
