"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SEVERITIES, SeverityMeter } from "@/components/ui/severity";
import { EmptyState } from "@/components/ui/state-view";
import { useToast } from "@/components/ui/toast";
import { useIsClient } from "@/features/account/browser-store";
import { SESSION_STUB } from "@/features/account/service";
import { ErrorPanel } from "@/features/errors/error-panel";
import { useProject as useApiProject } from "@/features/projects/api";
import { toLegacyProject } from "@/features/projects/project-shell";
import { hostOf, useProject, type Project } from "@/features/projects/store";
import { DashboardSkeleton } from "@/components/skeletons/page-skeletons";
import { QueryState } from "@/components/ui/query-state";
import { isUuid } from "@/lib/api/zod";
import { cn } from "@/lib/cn";
import { evidenceFor, FINDING_EXTRA, SAMPLE_MATRIX, SAMPLE_RUN, type RunSummary } from "./data";
import { isOpen, useFindings } from "./findings-store";
import { historyRows } from "./history-view";

/** Datos de la ejecución `n` de un proyecto. TODO(api): V-32 (fase 6) y la matriz aún sin conectar; vienen de `getRun`. */
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

type Variant = "run" | "current";
const SEV_BG = ["bg-sev-1", "bg-sev-2", "bg-sev-3", "bg-sev-4", "bg-sev-5"];
const FIXES = ["API1", "API2", "API3", "API4", "API5", "API8", "API9"];
const mono = "font-mono text-[12.5px]";

function Report({ project, runId }: { project: Project; runId: string }) {
  const t = useTranslations("Report");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  // TODO(api): V-32 (fase 6) aún usa los textos de los hallazgos de ejemplo.
  const tf = useTranslations("Report.sample");
  const format = useFormatter();
  const toast = useToast();
  const client = useIsClient();
  const { findings } = useFindings(project.id);
  const [variant, setVariant] = useState<Variant>("run");
  const run = runSummaryFor(project, runId);
  if (!run) return <ErrorPanel code={404} standalone={false} href={`/projects/${project.id}`} />;

  const base = `/projects/${project.id}`;
  const open = findings
    .filter(isOpen)
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
  const detailed = open.slice(0, 2);
  const total = run.severities.reduce((a, b) => a + b, 0);
  const runs = historyRows(project).length;
  const discrepancies = SAMPLE_MATRIX.flatMap((row) =>
    row.cells
      .map((cell, i) => ({ row, cell, i }))
      .filter(({ cell }) => cell.kind === "discrepancy"),
  );
  const isSample = project.id === "pedidos";
  const ranModules = (project.report?.modules ?? []).filter((m) => m.findings !== null);
  const skipped = (project.report?.modules ?? []).filter((m) => m.blocked);
  const stamp = client
    ? format.dateTime(new Date(), {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const runDate = format.dateTime(new Date(`${run.date}T16:20:00Z`), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const identities = ["Anónima", "Cliente A", "Cliente B", "Soporte"];

  function print() {
    toast.show({ type: "progress", title: t("printing") });
    window.setTimeout(() => window.print(), 150);
  }

  const th = "border-line-strong border-b-2 px-2 py-2 text-left";
  const td = "border-line border-b px-2 py-2";

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="print-hidden border-line bg-frame mx-auto mb-5 flex max-w-[1000px] flex-wrap items-center justify-between gap-3 rounded-3xl border p-3 backdrop-blur-2xl">
        <ButtonLink href={`${base}/runs/${run.number}`} variant="secondary">
          <Icon name="chevronLeft" size={16} />
          {t("back")}
        </ButtonLink>
        <div
          role="radiogroup"
          aria-label={t("typeLabel")}
          className="border-line bg-panel-2 flex flex-wrap gap-1.5 rounded-2xl border p-1.5"
        >
          {(["run", "current"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={variant === v}
              onClick={() => setVariant(v)}
              className={cn(
                "min-h-[42px] cursor-pointer rounded-[11px] px-4 text-[14.5px] font-semibold transition-colors duration-200",
                variant === v ? "bg-accent text-on-accent" : "text-fg",
              )}
            >
              {v === "run" ? t("variant.run", { number: run.number }) : t("variant.current")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({ type: "success", title: t("exported"), text: t("exportedText") })
            }
          >
            <Icon name="download" size={16} />
            {t("excel")}
          </Button>
          <Button onClick={print}>
            <Icon name="file" size={18} />
            {t("print")}
          </Button>
        </div>
      </div>

      <article className="print-sheet border-line bg-panel mx-auto flex max-w-[1000px] flex-col gap-8 rounded-[28px] border px-6 py-10 backdrop-blur-lg sm:px-16 sm:py-14">
        <header className="border-accent flex flex-wrap justify-between gap-6 border-b-2 pb-6">
          <div className="flex flex-col gap-2">
            <span className="text-muted text-[13px] font-bold tracking-[0.08em] uppercase">
              {t("brand", {
                type: variant === "run" ? t("type.run", { number: run.number }) : t("type.current"),
              })}
            </span>
            <h1 className="font-display text-[44px] leading-[1.05] font-medium tracking-[-0.03em]">
              {project.name}
            </h1>
            <span className="text-muted text-[15px]">
              {variant === "run"
                ? t("subtitle.run", { date: runDate })
                : t("subtitle.current", { date: stamp, count: runs })}
            </span>
          </div>
          <dl className="stagger m-0 grid h-fit grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">{t("generated")}</dt>
            <dd className="m-0">{stamp}</dd>
            <dt className="text-muted">{t("by")}</dt>
            <dd className="m-0">{SESSION_STUB.name}</dd>
            <dt className="text-muted">{t("baseUrl")}</dt>
            <dd className={cn("m-0", mono)}>{hostOf(project.baseUrl)}</dd>
          </dl>
        </header>

        <section aria-labelledby="r1" className="print-avoid flex flex-col gap-3.5">
          <h2 id="r1" className="text-[22px] font-semibold">
            {t("summary.title")}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            <table className="w-full border-collapse text-sm">
              <caption className="pb-2 text-left font-semibold">{t("summary.bySeverity")}</caption>
              <tbody>
                {SEVERITIES.map((s, i) => (
                  <tr key={s}>
                    <th scope="row" className={cn(td, "text-left font-medium")}>
                      <span
                        aria-hidden="true"
                        className={cn("mr-2 inline-block size-2.5 rounded-sm", SEV_BG[i])}
                      />
                      {ts(s)}
                    </th>
                    <td className={cn(td, "text-right font-bold")}>{run.severities[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full border-collapse text-sm">
              <caption className="pb-2 text-left font-semibold">{t("summary.byStatus")}</caption>
              <tbody>
                {(
                  [
                    ["new", run.comparison.new],
                    ["persistent", run.comparison.persistent],
                    ["regression", run.comparison.regression],
                    ["resolved", run.comparison.resolved],
                  ] as const
                ).map(([key, n]) => (
                  <tr key={key}>
                    <th scope="row" className={cn(td, "text-left font-medium")}>
                      {t(`summary.status.${key}`)}
                    </th>
                    <td className={cn(td, "text-right font-bold")}>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted text-sm leading-[1.6]">
            <b className="text-fg">{t("summary.modules")}</b>{" "}
            {ranModules.map((m) => tm(`names.${m.key}`)).join(", ") || t("summary.none")}.
            {skipped.length > 0
              ? ` ${t("summary.skipped", { modules: skipped.map((m) => tm(`names.${m.key}`)).join(", ") })}`
              : ""}{" "}
            {t("summary.limits", {
              rps: 5,
              concurrency: 2,
              total: format.number(2000),
              minutes: 15,
              requests: format.number(run.requests),
              duration: run.minutes,
            })}
          </p>
        </section>

        {isSample ? (
          <section aria-labelledby="r2" className="flex flex-col gap-3.5">
            <h2 id="r2" className="text-[22px] font-semibold">
              {t("matrix.title")}
            </h2>
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    {t("matrix.operation")}
                  </th>
                  <th scope="col" className={th}>
                    {t("matrix.identity")}
                  </th>
                  <th scope="col" className={th}>
                    {t("matrix.expected")}
                  </th>
                  <th scope="col" className={th}>
                    {t("matrix.observed")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {discrepancies.map(({ row, cell, i }) => (
                  <tr key={`${row.method}${row.path}${i}`}>
                    <td className={cn(td, mono)}>
                      {row.method ? `${row.method} ${row.path}` : t("matrix.global")}
                    </td>
                    <td className={td}>{identities[i]}</td>
                    <td className={td}>{t("matrix.deny")}</td>
                    <td className={cn(td, "font-bold")}>
                      !{" "}
                      {cell.code === "cors"
                        ? t("matrix.cors")
                        : t("matrix.allowed", { code: cell.code ?? "" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <span className="text-muted text-[13px]">
              {t("matrix.note", { rows: SAMPLE_MATRIX.length, identities: 4 })}
            </span>
          </section>
        ) : null}

        <div className="print-break border-line-strong flex items-center gap-3 border-t-2 border-dashed pt-1.5">
          <span className="text-muted print-hidden text-xs">{t("pageBreak")}</span>
        </div>

        <section aria-labelledby="r3" className="flex flex-col gap-4">
          <h2 id="r3" className="text-[22px] font-semibold">
            {t("findings.title")}
          </h2>
          {total === 0 || detailed.length === 0 ? (
            <EmptyState positive title={t("findings.none")} />
          ) : (
            detailed.map((f, index) => {
              const extra = FINDING_EXTRA[f.id];
              const evidence = evidenceFor(f, project.baseUrl);
              const owasp = f.owasp.split(":")[0];
              const fix = FIXES.includes(owasp) ? owasp : "API8";
              return (
                <article
                  key={f.id}
                  className="print-avoid border-line flex flex-col gap-3.5 border-b pb-5 last:border-0"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <SeverityMeter severity={f.severity} />
                    <b className="text-sm">{ts(f.severity)}</b>
                    <span className="text-muted text-[13.5px]">{tf(`statusName.${f.status}`)}</span>
                  </div>
                  <h3 className="text-xl font-semibold">
                    3.{index + 1} {f.title}
                  </h3>
                  <dl className="stagger m-0 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5 text-sm">
                    {[
                      [t("findings.module"), tm(`names.${f.module}`)],
                      [t("findings.owasp"), f.owasp],
                      [t("findings.cwe"), f.cwe],
                      [t("findings.identity"), f.identity],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-muted text-[12.5px]">{label}</dt>
                        <dd className="m-0">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {extra ? (
                    <p className="text-[14.5px] leading-[1.6]">
                      <b>{t("findings.expected")}</b> {tf(`expected.text.${extra.policy}`)}{" "}
                      <b>{t("findings.observed")}</b> {tf(`observed.text.${extra.policy}`)}
                    </p>
                  ) : null}
                  <pre className="bg-code-bg m-0 rounded-[14px] px-4 py-3.5 font-mono text-[12.5px] leading-[1.6] break-words whitespace-pre-wrap">
                    {evidence.request}
                    {"\n\n"}
                    {evidence.response}
                  </pre>
                  <p className="text-[14.5px] leading-[1.6]">
                    <b>{t("findings.fix")}</b> {tf(`fix.${fix as "API1"}`)}
                  </p>
                </article>
              );
            })
          )}
          {open.length > detailed.length ? (
            <p className="text-muted text-sm">
              {t("findings.more", { count: open.length - detailed.length })}
            </p>
          ) : null}
        </section>
      </article>
    </div>
  );
}

/** V-32. Reporte imprimible de una ejecución o del estado actual; se guarda como PDF desde el navegador (§9.2). */
export function ReportView({ id, runId }: { id: string; runId: string }) {
  // TODO(api): el reporte se conecta en la fase 6; mientras, un proyecto real (UUID) usa sus
  // datos de `getProject` con el resto de ejemplo, como las demás vistas sin conectar.
  if (isUuid(id)) return <ApiReportView id={id} runId={runId} />;
  return <LegacyReportView id={id} runId={runId} />;
}

function ApiReportView({ id, runId }: { id: string; runId: string }) {
  const tn = useTranslations("ProjectNav");
  const query = useApiProject(id);
  return (
    <QueryState query={query} subject={tn("subject")} skeleton={<DashboardSkeleton />}>
      {(project) => <ReportBody id={id} runId={runId} project={toLegacyProject(project)} />}
    </QueryState>
  );
}

function LegacyReportView({ id, runId }: { id: string; runId: string }) {
  const project = useProject(id);
  if (!project) return <ErrorPanel code={404} />;
  return <ReportBody id={id} runId={runId} project={project} />;
}

function ReportBody({ id, runId, project }: { id: string; runId: string; project: Project }) {
  const t = useTranslations("Report");
  if (!project.report)
    return (
      <div className="mx-auto max-w-[720px] p-6">
        <EmptyState
          title={t("empty.title")}
          text={t("empty.text")}
          action={{ label: t("empty.action"), href: `/projects/${id}/runs/new` }}
        />
      </div>
    );
  return <Report key={`${project.id}-${runId}`} project={project} runId={runId} />;
}
