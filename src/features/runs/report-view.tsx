"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { DashboardSkeleton, TablePageSkeleton } from "@/components/skeletons/page-skeletons";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { QueryState } from "@/components/ui/query-state";
import { SEVERITIES, SeverityMeter } from "@/components/ui/severity";
import { EmptyState } from "@/components/ui/state-view";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/features/account/api";
import { useIsClient } from "@/features/account/browser-store";
import { ErrorPanel } from "@/features/errors/error-panel";
import { useProject } from "@/features/projects/api";
import type { FindingStatus } from "@/lib/api/schemas/findings";
import type { Project } from "@/lib/api/schemas/projects";
import type { Run } from "@/lib/api/schemas/runs";
import { isUuid } from "@/lib/api/zod";
import { cn } from "@/lib/cn";
import { useFindings, useRun, useRunResults } from "./api";
import { badgeStatus } from "./finding-status";
import { MODULE_VIEW } from "./modules";

type Variant = "run" | "current";
type Severities = Project["open_findings_by_severity"];

const SEV_BG = ["bg-sev-1", "bg-sev-2", "bg-sev-3", "bg-sev-4", "bg-sev-5"];
const mono = "font-mono text-[12.5px]";
const th = "border-line-strong border-b-2 px-2 py-2 text-left";
const td = "border-line border-b px-2 py-2";

/** Estados abiertos (RF-69): los que cuenta el reporte. */
const OPEN: FindingStatus[] = ["new", "persistent", "regression"];

/** RF-64 y `PageSize`: discrepancias hasta 500 por página y hallazgos hasta 100. */
const RESULTS_PAGE = 500;
const FINDINGS_PAGE = 100;

/** Códigos de `Result.expected`/`observed` que el contrato nombra como ejemplo (igual que V-28). */
const CODES = ["allowed", "denied", "own_data_only", "no_sql_error"] as const;
const isCode = (part: string): part is (typeof CODES)[number] =>
  (CODES as readonly string[]).includes(part);

const isActive = (run: Run) => run.status === "queued" || run.status === "running";

function duration(run: Run) {
  if (!run.started_at || !run.finished_at) return "—";
  const seconds = Math.max(
    0,
    Math.round((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000),
  );
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Cuántos hallazgos tienen hoy el estado `status` (solo se lee `total`), de la ejecución o del proyecto. */
function useCount(
  projectId: string,
  status: FindingStatus,
  runId: string | undefined,
  enabled: boolean,
) {
  return useFindings(projectId, { status: [status], runId, pageSize: 1, enabled }).data?.total;
}

function SeverityTable({ counts }: { counts: Severities }) {
  const t = useTranslations("Report");
  const ts = useTranslations("Severity");
  return (
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
            <td className={cn(td, "text-right font-bold")}>{counts[s]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Hallazgos por estado. En la variante de ejecución, `listFindings` con `run_id` da el estado
 * **actual** de los detectados en ella, que solo es su resultado mientras sea la última.
 * TODO(api): no hay forma de saber cuántos se resolvieron en una ejecución.
 */
function StatusTable({ project, run, variant }: { project: Project; run: Run; variant: Variant }) {
  const t = useTranslations("Report");
  const tst = useTranslations("Status");
  const current = variant === "current";
  const runId = current ? undefined : run.id;
  const enabled = current || project.last_run?.id === run.id;
  const counts: Partial<Record<FindingStatus, number | undefined>> = {
    new: useCount(project.id, "new", runId, enabled),
    persistent: useCount(project.id, "persistent", runId, enabled),
    regression: useCount(project.id, "regression", runId, enabled),
    resolved: useCount(project.id, "resolved", undefined, current),
  };
  const rows: FindingStatus[] = current ? [...OPEN, "resolved"] : OPEN;
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="pb-2 text-left font-semibold">{t("summary.byStatus")}</caption>
      <tbody>
        {enabled ? (
          rows.map((key) => (
            <tr key={key}>
              <th scope="row" className={cn(td, "text-left font-medium")}>
                {key === "resolved" ? t("summary.resolved") : tst(`finding.${badgeStatus(key)}`)}
              </th>
              <td className={cn(td, "text-right font-bold")}>{counts[key] ?? "—"}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className={cn(td, "text-muted")}>{t("summary.onlyLatest")}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Discrepancias de la ejecución: `listRunResults` con `verdict=fail`. */
function Discrepancies({ project, run }: { project: Project; run: Run }) {
  const t = useTranslations("Report");
  const tx = useTranslations("Matrix");
  const tm = useTranslations("Dashboard.modules");
  const query = useRunResults(project.id, run.id, { pageSize: RESULTS_PAGE, verdict: ["fail"] });
  const code = (value: string) =>
    value
      .split(" ")
      .map((part) => (isCode(part) ? tx(`codes.${part}`) : part))
      .join(" ");
  return (
    <section aria-labelledby="r2" className="flex flex-col gap-3.5">
      <h2 id="r2" className="text-[22px] font-semibold">
        {t("matrix.title")}
      </h2>
      <QueryState
        query={query}
        subject={t("matrix.subject")}
        skeleton={<TablePageSkeleton rows={3} />}
      >
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState positive title={t("matrix.none")} />
          ) : (
            <>
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
                  {data.items.map((r) => (
                    <tr key={`${r.module}:${r.operation?.id ?? "global"}:${r.identity.id}`}>
                      <td className={td}>
                        <span className={cn("block break-all", mono)}>
                          {r.operation
                            ? `${r.operation.method} ${r.operation.path}`
                            : t("matrix.global")}
                        </span>
                        <span className="text-muted text-[12.5px]">
                          {tm(`names.${MODULE_VIEW[r.module].key}`)}
                        </span>
                      </td>
                      <td className={td}>
                        {r.identity.deleted
                          ? tx("identityDeleted", { name: r.identity.name })
                          : r.identity.name}
                      </td>
                      <td className={td}>{code(r.expected)}</td>
                      <td className={cn(td, "font-bold")}>! {code(r.observed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <span className="text-muted text-[13px]">
                {data.total > data.items.length
                  ? t("matrix.partial", { shown: data.items.length, total: data.total })
                  : t("matrix.note")}
              </span>
            </>
          )
        }
      </QueryState>
    </section>
  );
}

/**
 * Hallazgos detectados en la ejecución (`run_id`) o abiertos en el proyecto, por severidad.
 * TODO(api): `listFindings` no trae la evidencia ni la recomendación de `Finding`; el reporte
 * lista solo su clasificación.
 */
function Findings({ project, run, variant }: { project: Project; run: Run; variant: Variant }) {
  const t = useTranslations("Report");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  const tst = useTranslations("Status");
  const query = useFindings(project.id, {
    pageSize: FINDINGS_PAGE,
    ...(variant === "run" ? { runId: run.id } : { status: OPEN }),
  });
  return (
    <section aria-labelledby="r3" className="flex flex-col gap-4">
      <h2 id="r3" className="text-[22px] font-semibold">
        {t("findings.title")}
      </h2>
      <QueryState
        query={query}
        subject={t("findings.subject")}
        skeleton={<TablePageSkeleton rows={3} />}
      >
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              positive
              title={variant === "run" ? t("findings.noneRun") : t("findings.none")}
            />
          ) : (
            <>
              {data.items.map((f, index) => (
                <article
                  key={f.id}
                  className="print-avoid border-line flex flex-col gap-3 border-b pb-5 last:border-0"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <SeverityMeter severity={f.severity} />
                    <b className="text-sm">{ts(f.severity)}</b>
                    <span className="text-muted text-[13.5px]">
                      {tst(`finding.${badgeStatus(f.status)}`)}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold">
                    3.{index + 1} {f.title}
                  </h3>
                  <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5 text-sm">
                    {[
                      [t("findings.module"), tm(`names.${MODULE_VIEW[f.module].key}`)],
                      [t("findings.owasp"), f.owasp_category],
                      [t("findings.cwe"), f.cwe],
                      [
                        t("findings.operation"),
                        f.operation
                          ? `${f.operation.method} ${f.operation.path}`
                          : t("matrix.global"),
                      ],
                      [t("findings.identity"), f.identity?.name ?? "—"],
                      [
                        t("findings.runs"),
                        t("findings.runRange", {
                          first: f.first_run.number,
                          last: f.last_run.number,
                        }),
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-muted text-[12.5px]">{label}</dt>
                        <dd className="m-0 break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
              {data.total > data.items.length ? (
                <p className="text-muted text-sm">
                  {t("findings.more", { count: data.total - data.items.length })}
                </p>
              ) : null}
            </>
          )
        }
      </QueryState>
    </section>
  );
}

function Report({ project, run }: { project: Project; run: Run }) {
  const t = useTranslations("Report");
  const tm = useTranslations("Dashboard.modules");
  const format = useFormatter();
  const toast = useToast();
  const client = useIsClient();
  const me = useMe().data;
  const [variant, setVariant] = useState<Variant>("run");
  const base = `/projects/${project.id}`;
  const when = (date: Date) =>
    format.dateTime(date, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const stamp = client ? when(new Date()) : "—";
  // `RunSummary.number` es consecutivo por proyecto: el de la última dice cuántas hay.
  const runs = project.last_run?.number ?? 0;

  function print() {
    toast.show({ type: "progress", title: t("printing") });
    window.setTimeout(() => window.print(), 150);
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="print-hidden border-line bg-frame mx-auto mb-5 flex max-w-[1000px] flex-wrap items-center justify-between gap-3 rounded-3xl border p-3 backdrop-blur-2xl">
        <ButtonLink href={`${base}/runs/${run.id}`} variant="secondary">
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
        {/* TODO(api): el contrato no tiene exportación a Excel (RF-77). */}
        <Button onClick={print}>
          <Icon name="file" size={18} />
          {t("print")}
        </Button>
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
                ? t(run.status === "completed" ? "subtitle.run" : "subtitle.ended", {
                    date: when(new Date(run.finished_at ?? run.created_at)),
                  })
                : t("subtitle.current", { date: stamp, count: runs })}
            </span>
          </div>
          <dl className="m-0 grid h-fit grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">{t("generated")}</dt>
            <dd className="m-0">{stamp}</dd>
            <dt className="text-muted">{t("by")}</dt>
            <dd className="m-0">{me?.name ?? "—"}</dd>
            <dt className="text-muted">{t("baseUrl")}</dt>
            <dd className={cn("m-0", mono)}>{project.host}</dd>
          </dl>
        </header>

        <section aria-labelledby="r1" className="print-avoid flex flex-col gap-3.5">
          <h2 id="r1" className="text-[22px] font-semibold">
            {t("summary.title")}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            <SeverityTable
              counts={
                variant === "run"
                  ? run.progress.findings_by_severity
                  : project.open_findings_by_severity
              }
            />
            <StatusTable project={project} run={run} variant={variant} />
          </div>
          {variant === "run" ? (
            <p className="text-muted text-sm leading-[1.6]">
              <b className="text-fg">{t("summary.modules")}</b>{" "}
              {run.modules.map((m) => tm(`names.${MODULE_VIEW[m].key}`)).join(", ") ||
                t("summary.none")}
              .{" "}
              {t("summary.limits", {
                rps: run.limits.requests_per_second,
                concurrency: run.limits.concurrency,
                total: format.number(run.limits.max_requests),
                minutes: run.limits.max_duration_minutes,
                requests: format.number(run.progress.requests_sent),
                duration: duration(run),
              })}
            </p>
          ) : (
            <p className="text-muted text-sm leading-[1.6]">
              {project.concluded ? t("summary.concluded") : t("summary.open")}
            </p>
          )}
        </section>

        {variant === "run" ? <Discrepancies project={project} run={run} /> : null}

        <div className="print-break border-line-strong flex items-center gap-3 border-t-2 border-dashed pt-1.5">
          <span className="text-muted print-hidden text-xs">{t("pageBreak")}</span>
        </div>

        <Findings key={variant} project={project} run={run} variant={variant} />
      </article>
    </div>
  );
}

function ReportBody({ project, runId }: { project: Project; runId: string }) {
  const t = useTranslations("Report");
  const tr = useTranslations("RunResults");
  const query = useRun(project.id, runId);
  return (
    <QueryState query={query} subject={tr("subject")} skeleton={<DashboardSkeleton />}>
      {(run) =>
        isActive(run) ? (
          <div className="mx-auto max-w-[720px] p-6">
            <EmptyState
              title={t("active.title")}
              text={t("active.text")}
              action={{ label: t("active.action"), href: `/projects/${project.id}/runs/current` }}
            />
          </div>
        ) : (
          <Report project={project} run={run} />
        )
      }
    </QueryState>
  );
}

function ProjectReport({ id, runId }: { id: string; runId: string }) {
  const tn = useTranslations("ProjectNav");
  const query = useProject(id);
  return (
    <QueryState query={query} subject={tn("subject")} skeleton={<DashboardSkeleton />}>
      {(project) => <ReportBody key={runId} project={project} runId={runId} />}
    </QueryState>
  );
}

/** V-32. Reporte imprimible de una ejecución o del estado actual; se guarda como PDF desde el navegador (§9.2). */
export function ReportView({ id, runId }: { id: string; runId: string }) {
  if (!isUuid(id) || !isUuid(runId)) return <ErrorPanel code={404} />;
  return <ProjectReport id={id} runId={runId} />;
}
