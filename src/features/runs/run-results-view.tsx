"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DetailSkeleton } from "@/components/skeletons/page-skeletons";
import { Banner } from "@/components/ui/banner";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { QueryState } from "@/components/ui/query-state";
import { SEVERITIES, SeverityMeter } from "@/components/ui/severity";
import { EmptyState } from "@/components/ui/state-view";
import { ErrorPanel } from "@/features/errors/error-panel";
import { ProjectShell } from "@/features/projects/project-shell";
import { Link } from "@/i18n/navigation";
import { OPEN_STATUSES, type FindingStatus } from "@/lib/api/schemas/findings";
import type { Project } from "@/lib/api/schemas/projects";
import type { Run } from "@/lib/api/schemas/runs";
import { isUuid } from "@/lib/api/zod";
import { cn } from "@/lib/cn";
import { useFindings, useRun } from "./api";
import { FailedResources } from "./failed-resources";
import { MODULE_ORDER, MODULE_VIEW } from "./modules";
import { RerunButton } from "./rerun-button";
import { RunTabs } from "./run-tabs";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";

const STATUS_CHIP = {
  completed: { icon: "check", tone: "text-success bg-success-bg" },
  cancelled: { icon: "stop", tone: "text-warning bg-warning-bg" },
  failed: { icon: "alert", tone: "text-danger bg-danger-bg" },
} as const;

/** Cuántos hallazgos de la ejecución tienen hoy el estado `status` (solo se lee `total`). */
function useStatusCount(projectId: string, runId: string, status: FindingStatus, enabled: boolean) {
  const query = useFindings(projectId, { runId, status: [status], pageSize: 1, enabled });
  return query.data?.total;
}

/**
 * Comparación con la ejecución anterior. `listFindings` con `run_id` da el estado **actual** de
 * los hallazgos detectados en la ejecución, que solo coincide con su resultado mientras sea la
 * última del proyecto.
 * TODO(api): no hay forma de saber cuántos se resolvieron en una ejecución ni la comparación de
 * una ejecución que ya no es la última.
 */
function Comparison({ project, run }: { project: Project; run: Run }) {
  const t = useTranslations("RunResults");
  const latest = project.last_run?.id === run.id;
  const counts = {
    new: useStatusCount(project.id, run.id, "new", latest && run.number > 1),
    persistent: useStatusCount(project.id, run.id, "persistent", latest && run.number > 1),
    regression: useStatusCount(project.id, run.id, "regression", latest && run.number > 1),
  };
  const items = [
    { n: counts.new, name: t("comparison.new"), dot: "bg-accent" },
    { n: counts.persistent, name: t("comparison.persistent"), dot: "bg-muted" },
    { n: counts.regression, name: t("comparison.regression"), dot: "bg-danger" },
  ];
  return (
    <section aria-labelledby="cmp-h" className={cn(card, "min-w-[280px] flex-[1_1_300px]")}>
      <h2 id="cmp-h" className="text-lg font-semibold">
        {run.number > 1 ? t("comparison.title", { number: run.number - 1 }) : t("comparison.first")}
      </h2>
      {run.number === 1 ? (
        <span className="text-muted text-sm">{t("comparison.firstText")}</span>
      ) : !latest ? (
        <span className="text-muted text-sm">{t("comparison.onlyLatest")}</span>
      ) : (
        <>
          <ul className="stagger m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 p-0">
            {items.map((c) => (
              <li key={c.name} className="bg-panel-2 flex flex-col gap-1 rounded-[18px] px-4 py-3">
                <span className="font-display text-3xl leading-none font-medium tabular-nums">
                  {c.n ?? "—"}
                </span>
                <span className="text-muted flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className={cn("size-2 rounded-full", c.dot)} />
                  {c.name}
                </span>
              </li>
            ))}
          </ul>
          <span className="text-muted text-[13px] leading-[1.5]">{t("comparison.note")}</span>
        </>
      )}
    </section>
  );
}

function Results({ project, run }: { project: Project; run: Run }) {
  const t = useTranslations("RunResults");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  const format = useFormatter();
  const base = `/projects/${project.id}`;
  const counts = run.progress.findings_by_severity;
  const top = useFindings(project.id, { runId: run.id, status: [...OPEN_STATUSES], pageSize: 3 });
  const status = run.status === "cancelled" || run.status === "failed" ? run.status : "completed";
  const chip = STATUS_CHIP[status];
  const minutes =
    run.started_at && run.finished_at
      ? Math.max(1, Math.round((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 60_000))
      : null;
  const when = run.finished_at ?? run.created_at;

  const stats: [string, string][] = [
    [format.number(run.progress.requests_sent), t("stats.requests")],
    [minutes === null ? "—" : String(minutes), t("stats.minutes")],
    [`${run.modules.length} / ${MODULE_ORDER.length}`, t("stats.modules")],
    [
      `${format.number(run.progress.cells_evaluated)} / ${format.number(run.progress.cells_planned)}`,
      t("stats.cells"),
    ],
  ];
  const partial = run.end_reason === "limit_reached" || run.status !== "completed";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RunTabs base={base} run={run.id} active="summary" findings={counts.total} />
        <ButtonLink href={`${base}/runs/${run.id}/report`} variant="secondary" size="sm">
          <Icon name="file" size={16} />
          {t("report")}
        </ButtonLink>
      </div>

      <FailedResources projectId={project.id} items={run.created_resources.failed_items} />

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="hr-h"
          className="border-line flex min-w-0 flex-[999_1_560px] flex-col gap-5 rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-8"
        >
          <span
            className={cn(
              "inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[13px] font-semibold",
              chip.tone,
            )}
          >
            <Icon name={chip.icon} size={16} strokeWidth={2.6} />
            {t(`status.${status}`, {
              date: format.dateTime(new Date(when), {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </span>
          <ul
            aria-label={t("data")}
            className="text-muted m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm"
          >
            {run.end_reason ? <li>{t(`end.${run.end_reason}`)}</li> : null}
            {run.contract_version ? (
              <li>{t("contract", { number: run.contract_version.number })}</li>
            ) : null}
            {run.source_run_id ? (
              <li>
                <Link href={`${base}/runs/${run.source_run_id}`} className="text-link">
                  {t("repeat")}
                </Link>
              </li>
            ) : null}
          </ul>
          <h2 id="hr-h" className="font-display text-4xl leading-tight font-medium">
            {t("headline", { count: counts.total })}
          </h2>
          <div className="flex flex-wrap gap-3">
            <RerunButton project={project} run={run} label={t("retest")} />
            <ButtonLink href={`${base}/findings?run=${run.id}`} variant="secondary" size="lg">
              {t("viewFindings")}
            </ButtonLink>
          </div>
          <dl className="border-line bg-panel-2 m-0 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4 rounded-[22px] border px-[22px] py-[18px]">
            {stats.map(([value, label]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-muted order-2 text-[13px]">{label}</dt>
                <dd className="font-display order-1 m-0 text-[28px] leading-none font-medium tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <Comparison project={project} run={run} />
      </div>

      <section aria-labelledby="sv-h" className={card}>
        <h2 id="sv-h" className="text-lg font-semibold">
          {t("bySeverity")}
        </h2>
        <ul className="stagger m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 p-0">
          {SEVERITIES.map((s) => (
            <li key={s} className="bg-panel-2 flex flex-col gap-2 rounded-[18px] px-4 py-3.5">
              <SeverityMeter severity={s} />
              <span className="font-display text-3xl leading-none font-medium tabular-nums">
                {counts[s]}
              </span>
              <span className="text-muted text-sm">{ts(s)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="me-h" className={cn(card, "min-w-0 flex-[999_1_520px]")}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="me-h" className="text-lg font-semibold">
              {t("modules")}
            </h2>
            <span className="text-muted text-[13px]">
              {t("limits", {
                rps: run.limits.requests_per_second,
                concurrency: run.limits.concurrency,
                total: format.number(run.limits.max_requests),
                minutes: run.limits.max_duration_minutes,
              })}
            </span>
          </div>
          {/* TODO(api): `Run` no trae hallazgos ni avance por módulo; solo si se ejecutó. */}
          <ul className="stagger m-0 flex list-none flex-col gap-2 p-0">
            {MODULE_ORDER.map((module) => {
              const view = MODULE_VIEW[module];
              const ran = run.modules.includes(module);
              return (
                <li
                  key={module}
                  className={cn(
                    "border-line bg-panel-2 flex flex-wrap items-center gap-4 rounded-[20px] border px-4 py-3",
                    !ran && "opacity-70",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="bg-progress-bg text-accent font-display inline-flex size-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold"
                  >
                    {view.code}
                  </span>
                  <span className="min-w-[160px] flex-1 text-[15px] font-semibold">
                    {tm(`names.${view.key}`)}
                  </span>
                  <span className="text-muted text-sm">
                    {ran ? t("moduleRun") : t("moduleNotSelected")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="flex min-w-[280px] flex-[1_1_320px] flex-col gap-5">
          {partial ? (
            <section aria-labelledby="ax-h" className={card}>
              <h2 id="ax-h" className="text-lg font-semibold">
                {t("notices.title")}
              </h2>
              {partial ? (
                <Banner title={t(`notices.partial.${status}.title`)}>
                  {t(`notices.partial.${status}.text`)}
                </Banner>
              ) : null}
            </section>
          ) : null}
          {top.data && top.data.items.length > 0 ? (
            <section aria-labelledby="tp-h" className={card}>
              <h2 id="tp-h" className="text-lg font-semibold">
                {t("top")}
              </h2>
              {top.data.items.map((f) => (
                <Link
                  key={f.id}
                  href={`${base}/findings/${f.id}`}
                  className="bg-panel-2 text-fg flex flex-col gap-1.5 rounded-[16px] px-4 py-3 no-underline"
                >
                  <span className="flex items-center gap-2.5 text-[13px] font-bold">
                    <SeverityMeter severity={f.severity} />
                    {ts(f.severity)}
                  </span>
                  <span className="text-sm">{f.title}</span>
                </Link>
              ))}
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function RunResults({ project, runId }: { project: Project; runId: string }) {
  const t = useTranslations("RunResults");
  const query = useRun(project.id, runId);
  return (
    <QueryState query={query} subject={t("subject")} skeleton={<DetailSkeleton />}>
      {(run) =>
        run.status === "queued" || run.status === "running" ? (
          <EmptyState
            title={t("active.title", { number: run.number })}
            text={t("active.text")}
            action={{ label: t("active.action"), href: `/projects/${project.id}/runs/current` }}
          />
        ) : (
          <Results project={project} run={run} />
        )
      }
    </QueryState>
  );
}

/** Título con el número de la ejecución en cuanto `getRun` responde. */
function useRunTitle(id: string, runId: string) {
  const t = useTranslations("RunResults");
  const run = useRun(id, isUuid(id) && isUuid(runId) ? runId : null).data;
  return run ? t("title", { number: run.number }) : t("titleLoading");
}

/** V-27. Resultados de una ejecución: resumen, comparación con la anterior y avisos (RF-54 a RF-60, RF-71). */
export function RunResultsView({ id, runId }: { id: string; runId: string }) {
  const t = useTranslations("RunResults");
  const title = useRunTitle(id, runId);
  return (
    <ProjectShell
      id={id}
      trail={[{ label: t("crumbHistory"), href: `/projects/${id}/history` }, { label: title }]}
      title={title}
      render={(project) =>
        isUuid(runId) ? (
          <RunResults key={runId} project={project} runId={runId} />
        ) : (
          <ErrorPanel code={404} standalone={false} href={`/projects/${id}`} />
        )
      }
    />
  );
}
