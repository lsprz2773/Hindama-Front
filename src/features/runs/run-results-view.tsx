"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Banner } from "@/components/ui/banner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PendingResources } from "@/components/ui/pending-resources";
import { SEVERITIES, SeverityMeter, type Severity } from "@/components/ui/severity";
import { EmptyState } from "@/components/ui/state-view";
import { useToast } from "@/components/ui/toast";
import { ErrorPanel } from "@/features/errors/error-panel";
import { ProjectShell } from "@/features/projects/project-shell";
import { updateProject, type Project } from "@/features/projects/store";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { SAMPLE_PENDING_RESOURCES, SAMPLE_RUN, type RunSummary } from "./data";
import { useFindings } from "./findings-store";
import { RunTabs } from "./run-tabs";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";

/** Datos de la ejecución `n` de un proyecto. TODO(api): vienen del detalle de la ejecución. */
export function runSummaryFor(project: Project, runId: string): RunSummary | null {
  const report = project.report;
  const n = Number(runId);
  if (!report || !Number.isInteger(n) || n < 1 || n > report.runNumber) return null;
  if (project.id === "pedidos") return { ...SAMPLE_RUN, number: n };
  return {
    number: n,
    date: report.date,
    requests: report.requests,
    minutes: report.minutes,
    modulesRun: report.modulesRun,
    blocked: 0,
    comparison: { new: 0, persistent: 0, resolved: 0, regression: 0 },
    severities: report.severities,
  };
}

function Results({ project, run }: { project: Project; run: RunSummary }) {
  const t = useTranslations("RunResults");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  const format = useFormatter();
  const toast = useToast();
  const router = useRouter();
  const { findings } = useFindings(project.id);
  const base = `/projects/${project.id}`;
  const total = run.severities.reduce((a, b) => a + b, 0);
  const isSample = project.id === "pedidos";
  const modules = project.report?.modules ?? [];
  const top = [...findings]
    .filter((f) => f.status !== "resolved" && f.status !== "acceptedRisk")
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
    .slice(0, 3);

  function retest() {
    if (project.running !== undefined) {
      toast.show({ type: "warning", title: t("retestBusy") });
      return;
    }
    updateProject(project.id, { running: 0 });
    toast.show({ type: "info", title: t("retestStarted", { number: run.number }) });
    router.push(`${base}/runs/current`);
  }

  const stats: [string, string][] = [
    [format.number(run.requests), t("stats.requests")],
    [run.minutes, t("stats.minutes")],
    [`${run.modulesRun} / 7`, t("stats.modules")],
    [String(run.blocked), t("stats.blocked")],
  ];
  const comparison = [
    { n: run.comparison.new, name: t("comparison.new"), dot: "bg-accent" },
    { n: run.comparison.persistent, name: t("comparison.persistent"), dot: "bg-muted" },
    { n: run.comparison.resolved, name: t("comparison.resolved"), dot: "bg-success" },
    { n: run.comparison.regression, name: t("comparison.regression"), dot: "bg-danger" },
  ];
  const blockedModules = modules.filter((m) => m.blocked);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RunTabs base={base} run={run.number} active="summary" findings={total} />
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`${base}/runs/${run.number}/report`} variant="secondary" size="sm">
            <Icon name="file" size={16} />
            {t("report")}
          </ButtonLink>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.show({ type: "success", title: t("exported"), text: t("exportedText") })
            }
          >
            <Icon name="download" size={16} />
            {t("export")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="hr-h"
          className="border-line flex min-w-0 flex-[999_1_560px] flex-col gap-5 rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-8"
        >
          <span className="text-success bg-success-bg inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[13px] font-semibold">
            <Icon name="check" size={16} strokeWidth={2.6} />
            {t("completed", {
              date: format.dateTime(new Date(`${run.date}T16:20:00Z`), {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              }),
            })}
          </span>
          <ul
            aria-label={t("data")}
            className="text-muted m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm"
          >
            <li>{t("end.normal")}</li>
            {project.contractOps !== null ? <li>{t("contract", { version: "v2.4.0" })}</li> : null}
            {run.number > 1 ? <li>{t("repeat", { number: run.number - 1 })}</li> : null}
          </ul>
          <div className="flex flex-col gap-2">
            <h2 id="hr-h" className="font-display text-4xl leading-tight font-medium">
              {t("headline", { count: total })}
            </h2>
            {total > 0 ? (
              <p className="text-muted text-[15px]">
                {t("headlineText", {
                  new: run.comparison.new,
                  regressions: run.comparison.regression,
                })}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={retest}>
              <Icon name="play" size={16} />
              {t("retest")}
            </Button>
            <ButtonLink href={`${base}/findings`} variant="secondary" size="lg">
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

        <section aria-labelledby="cmp-h" className={cn(card, "min-w-[280px] flex-[1_1_300px]")}>
          <h2 id="cmp-h" className="text-lg font-semibold">
            {run.number > 1
              ? t("comparison.title", { number: run.number - 1 })
              : t("comparison.first")}
          </h2>
          {run.number > 1 ? (
            <>
              <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
                {comparison.map((c) => (
                  <li
                    key={c.name}
                    className="bg-panel-2 flex flex-col gap-1 rounded-[18px] px-4 py-3"
                  >
                    <span className="font-display text-3xl leading-none font-medium tabular-nums">
                      {c.n}
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
          ) : (
            <span className="text-muted text-sm">{t("comparison.firstText")}</span>
          )}
        </section>
      </div>

      <section aria-labelledby="sv-h" className={card}>
        <h2 id="sv-h" className="text-lg font-semibold">
          {t("bySeverity")}
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 p-0">
          {SEVERITIES.map((s: Severity, i) => (
            <li key={s} className="bg-panel-2 flex flex-col gap-2 rounded-[18px] px-4 py-3.5">
              <SeverityMeter severity={s} />
              <span className="font-display text-3xl leading-none font-medium tabular-nums">
                {run.severities[i]}
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
              {t("limits", { rps: 5, concurrency: 2, total: format.number(2000), minutes: 15 })}
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {modules.map((m) => {
              const incomplete = isSample && m.key === "objects";
              const note =
                m.findings === null
                  ? m.blocked
                    ? t("moduleBlocked")
                    : t("moduleNotSelected")
                  : t("moduleFindings", { count: m.findings }) +
                    (incomplete ? ` · ${t("incomplete")}` : "");
              return (
                <li
                  key={m.key}
                  className={cn(
                    "border-line bg-panel-2 flex flex-wrap items-center gap-4 rounded-[20px] border px-4 py-3",
                    m.findings === null && "opacity-70",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="bg-progress-bg text-accent font-display inline-flex size-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold"
                  >
                    {m.code}
                  </span>
                  <span className="min-w-[160px] flex-1 text-[15px] font-semibold">
                    {tm(`names.${m.key}`)}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      m.blocked || incomplete ? "text-warning" : "text-muted",
                    )}
                  >
                    {note}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="flex min-w-[280px] flex-[1_1_320px] flex-col gap-5">
          {isSample || blockedModules.length > 0 ? (
            <section aria-labelledby="ax-h" className={card}>
              <h2 id="ax-h" className="text-lg font-semibold">
                {t("notices.title")}
              </h2>
              {isSample ? (
                <Banner title={t("notices.expired.title", { name: "Cliente B" })}>
                  {t("notices.expired.text", { count: 38 })}
                </Banner>
              ) : null}
              {blockedModules.map((m) => (
                <Banner
                  key={m.key}
                  title={t("notices.skipped.title", { module: tm(`names.${m.key}`) })}
                >
                  {t("notices.skipped.text")}
                </Banner>
              ))}
            </section>
          ) : null}
          {isSample ? <PendingResources resources={SAMPLE_PENDING_RESOURCES} /> : null}
          {top.length > 0 ? (
            <section aria-labelledby="tp-h" className={card}>
              <h2 id="tp-h" className="text-lg font-semibold">
                {t("top")}
              </h2>
              {top.map((f) => (
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

/** V-27. Resultados de una ejecución: resumen, comparación con la anterior y avisos (RF-54 a RF-60, RF-71). */
export function RunResultsView({ id, runId }: { id: string; runId: string }) {
  const t = useTranslations("RunResults");
  return (
    <ProjectShell
      id={id}
      trail={[
        { label: t("crumbHistory"), href: `/projects/${id}/history` },
        { label: t("title", { number: runId }) },
      ]}
      title={t("title", { number: runId })}
    >
      {(project) => {
        const run = runSummaryFor(project, runId);
        if (!project.report)
          return (
            <EmptyState
              title={t("none.title")}
              text={t("none.text")}
              action={{ label: t("none.action"), href: `/projects/${id}/runs/new` }}
            />
          );
        if (!run) return <ErrorPanel code={404} standalone={false} href={`/projects/${id}`} />;
        return <Results key={`${project.id}-${runId}`} project={project} run={run} />;
      }}
    </ProjectShell>
  );
}
