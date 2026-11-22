"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { TablePageSkeleton } from "@/components/skeletons/page-skeletons";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { QueryState } from "@/components/ui/query-state";
import { SEVERITIES } from "@/components/ui/severity";
import { EmptyState } from "@/components/ui/state-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { inputClass } from "@/components/ui/text-field";
import { useProject } from "@/features/projects/api";
import { hasActiveRun, ProjectShell } from "@/features/projects/project-shell";
import type { Project } from "@/lib/api/schemas/projects";
import type { Schemas } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useFindings, useRuns } from "./api";
import { RerunButton } from "./rerun-button";

type RunStatus = Schemas["RunStatus"];
type RunSummary = Schemas["RunSummary"];

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";
const SEV_BG = ["bg-sev-1", "bg-sev-2", "bg-sev-3", "bg-sev-4", "bg-sev-5"];
const GRID =
  "grid min-w-[900px] grid-cols-[90px_minmax(0,1.3fr)_130px_90px_110px_minmax(0,1.5fr)_180px] items-center gap-3";
const STATUSES: RunStatus[] = ["queued", "running", "completed", "cancelled", "failed"];

/** RF-71: 20 ejecuciones por página (`listRuns`), de la más reciente a la más antigua. */
const PAGE_SIZE = 20;

const isActive = (run: RunSummary) => run.status === "queued" || run.status === "running";

function minutes(run: RunSummary) {
  if (!run.started_at || !run.finished_at) return "—";
  const seconds = Math.max(
    0,
    Math.round((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000),
  );
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Estado del proyecto: concluido (RF-73), abiertos ahora y resueltos en total. */
function Standing({ project }: { project: Project }) {
  const t = useTranslations("History");
  const resolved = useFindings(project.id, { status: ["resolved"], pageSize: 1 });
  return (
    <section
      aria-labelledby="st-h"
      className="border-line flex min-w-[300px] flex-[1_1_340px] flex-col gap-3.5 rounded-[28px] border bg-[image:var(--hero)] p-7"
    >
      <span className="border-line bg-panel-2 inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[13px] font-semibold">
        <Icon name="refresh" size={14} className="text-accent" strokeWidth={2.4} />
        {project.concluded ? t("concluded.badge") : t("following")}
      </span>
      <h2 id="st-h" className="font-display text-4xl leading-none font-medium tracking-[-0.03em]">
        {project.concluded ? t("concluded.title") : t("notConcluded")}
      </h2>
      <p className="text-muted text-[14.5px] leading-[1.55]">
        {project.concluded ? t("concluded.text") : t("rule")}
      </p>
      <dl className="border-line bg-panel-2 m-0 grid grid-cols-2 gap-3 rounded-[20px] border px-[18px] py-4">
        {[
          [String(project.open_findings_by_severity.total), t("openNow")],
          [resolved.data ? String(resolved.data.total) : "—", t("resolvedTotal")],
        ].map(([value, label]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-muted order-2 text-[13px]">{label}</dt>
            <dd className="font-display order-1 m-0 text-3xl leading-none font-medium tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Hallazgos detectados en cada ejecución de la página (`RunSummary.findings_by_severity`).
 * TODO(api): el contrato no trae cuántos quedaron abiertos al terminar cada una.
 */
function Chart({ runs }: { runs: RunSummary[] }) {
  const t = useTranslations("History");
  const bars = [...runs].reverse();
  const max = Math.max(1, ...bars.map((r) => r.findings_by_severity.total));
  const running = runs.find(isActive);
  return (
    <section aria-labelledby="ev-h" className={cn(card, "min-w-0 flex-[999_1_520px]")}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="ev-h" className="text-lg font-semibold">
          {t("chart.title")}
        </h2>
        {running ? (
          <span className="text-muted text-[13.5px]">
            {t("chart.running", { number: running.number })}
          </span>
        ) : null}
      </div>
      <div
        role="img"
        aria-label={t("chart.summary", {
          items: bars
            .map((r) =>
              t(isActive(r) ? "chart.itemRunning" : "chart.item", {
                number: r.number,
                count: r.findings_by_severity.total,
              }),
            )
            .join("; "),
        })}
        className="border-line-strong flex h-[220px] items-end gap-6 border-b px-2"
      >
        {bars.map((r) => {
          const value = r.findings_by_severity.total;
          return (
            <div
              key={r.id}
              title={t("chart.tip", { number: r.number, count: value })}
              className="flex h-full flex-1 flex-col items-center justify-end gap-2"
            >
              <span className="text-sm font-bold tabular-nums">
                {value}
                {isActive(r) ? "*" : ""}
              </span>
              <span
                className={cn(
                  "border-accent animate-grow-y w-full max-w-[72px] origin-bottom rounded-t border",
                  isActive(r) ? "border-dashed bg-transparent" : "bg-accent",
                )}
                style={{ height: `${Math.max(4, Math.round((value / max) * 160))}px` }}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="flex gap-6 px-2">
        {bars.map((r) => (
          <span key={r.id} className="text-muted flex-1 text-center text-[13px]">
            {isActive(r)
              ? t("chart.labelRunning", { number: r.number })
              : t("chart.label", { number: r.number })}
          </span>
        ))}
      </div>
    </section>
  );
}

function History({ project }: { project: Project }) {
  const t = useTranslations("History");
  const ts = useTranslations("Severity");
  const tst = useTranslations("Status");
  const format = useFormatter();
  const base = `/projects/${project.id}`;
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RunStatus | "all">("all");
  const query = useRuns(project.id, {
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : [status],
  });

  if (!project.last_run)
    return (
      <EmptyState
        title={t("empty.title")}
        text={t("empty.text")}
        action={{ label: t("empty.action"), href: `${base}/runs/new` }}
      />
    );

  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <QueryState query={query} subject={t("subject")} skeleton={<TablePageSkeleton rows={4} />}>
      {(data) => {
        const pages = Math.max(1, Math.ceil(data.total / data.page_size));
        return (
          <>
            <div className="flex flex-wrap items-stretch gap-5">
              <Standing project={project} />
              <Chart runs={data.items} />
            </div>

            <section aria-labelledby="ej-h" className={cn(card, "gap-2 overflow-x-auto")}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="ej-h" className="text-lg font-semibold">
                  {t("runs", { count: data.total })}
                </h2>
                <div className="flex min-w-[200px] flex-col gap-1.5">
                  <label htmlFor="h-status" className="text-sm font-semibold">
                    {t("filter")}
                  </label>
                  <select
                    id="h-status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as RunStatus | "all");
                      setPage(1);
                    }}
                    className={inputClass}
                  >
                    <option value="all">{t("allStatuses")}</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {tst(`run.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {data.items.length === 0 ? (
                <p className="text-muted text-sm">{t("none")}</p>
              ) : (
                <>
                  <div aria-hidden="true" className={cn(GRID, "text-muted px-4 text-[12.5px]")}>
                    <span>{t("cols.run")}</span>
                    <span>{t("cols.date")}</span>
                    <span>{t("cols.status")}</span>
                    <span>{t("cols.duration")}</span>
                    <span>{t("cols.requests")}</span>
                    <span>{t("cols.severity")}</span>
                    <span />
                  </div>
                  <ul className="stagger m-0 flex min-w-[900px] list-none flex-col gap-1.5 p-0">
                    {data.items.map((r) => (
                      <li
                        key={r.id}
                        className={cn(
                          GRID,
                          "bg-panel-2 rounded-[18px] border px-4 py-3",
                          isActive(r) ? "border-accent/55" : "border-line",
                        )}
                      >
                        <b className="font-display text-xl font-medium">
                          {t("number", { number: r.number })}
                        </b>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold">
                            {date(r.started_at ?? r.created_at)}
                          </span>
                          <span className="text-muted text-[12.5px]">
                            {t("kind", { count: r.modules.length })}
                          </span>
                        </span>
                        <span>
                          <StatusBadge kind="run" status={r.status} />
                        </span>
                        <span className="text-sm tabular-nums">{minutes(r)}</span>
                        <span className="text-sm tabular-nums">
                          {format.number(r.requests_sent)}
                        </span>
                        <span className="flex gap-2.5 text-[13px] tabular-nums">
                          {SEVERITIES.map((s, i) => (
                            <span key={s} className="inline-flex items-center gap-1">
                              <span
                                aria-hidden="true"
                                className={cn("size-2 rounded-sm", SEV_BG[i])}
                              />
                              <span className="sr-only">{ts(s)} </span>
                              {r.findings_by_severity[s]}
                            </span>
                          ))}
                        </span>
                        <span className="flex justify-end gap-1.5">
                          <ButtonLink
                            href={isActive(r) ? `${base}/runs/current` : `${base}/runs/${r.id}`}
                            variant="secondary"
                            className="min-h-10 rounded-xl px-3 text-sm"
                            aria-label={
                              isActive(r)
                                ? t("viewProgressOf", { number: r.number })
                                : t("openOf", { number: r.number })
                            }
                          >
                            {isActive(r) ? t("viewProgress") : t("open")}
                          </ButtonLink>
                          {!isActive(r) ? (
                            <ButtonLink
                              href={`${base}/runs/${r.id}/report`}
                              variant="secondary"
                              className="min-h-10 rounded-xl px-3 text-sm"
                              aria-label={t("reportOf", { number: r.number })}
                            >
                              {t("report")}
                            </ButtonLink>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {pages > 1 ? (
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1 || query.isFetching}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        {t("previous")}
                      </Button>
                      <span className="text-muted text-[13px]">{t("page", { page, pages })}</span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page >= pages || query.isFetching}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        {t("next")}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </>
        );
      }}
    </QueryState>
  );
}

/** Repetir la última ejecución (RF-71) o ir a la que está en curso. */
function RepeatAction({ id }: { id: string }) {
  const t = useTranslations("History");
  const project = useProject(id).data;
  if (!project?.last_run || project.verification_status !== "verified") return null;
  if (hasActiveRun(project))
    return (
      <ButtonLink href={`/projects/${project.id}/runs/current`} variant="secondary">
        {t("viewProgress")}
      </ButtonLink>
    );
  return <RerunButton project={project} run={project.last_run} label={t("repeat")} size="md" />;
}

/** V-31. Historial: estado del proyecto y todas sus ejecuciones (RF-71 a RF-73). */
export function HistoryView({ id }: { id: string }) {
  const t = useTranslations("History");
  return (
    <ProjectShell
      id={id}
      section={t("title")}
      title={t("title")}
      actions={<RepeatAction id={id} />}
      render={(project) => <History key={project.id} project={project} />}
    />
  );
}
