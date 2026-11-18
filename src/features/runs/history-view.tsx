"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SEVERITIES } from "@/components/ui/severity";
import { EmptyState } from "@/components/ui/state-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { ProjectShell } from "@/features/projects/project-shell";
import { updateProject, type Project } from "@/features/projects/store";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { RESOLVED_TOTAL, SAMPLE_HISTORY, SEED_FINDINGS, type HistoryRun } from "./data";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";
const SEV_BG = ["bg-sev-1", "bg-sev-2", "bg-sev-3", "bg-sev-4", "bg-sev-5"];
const GRID =
  "grid min-w-[1060px] grid-cols-[90px_minmax(0,1.2fr)_130px_90px_110px_minmax(0,1.5fr)_minmax(0,1.6fr)_180px] items-center gap-3";

/** Ejecuciones del proyecto, de la más reciente a la más antigua. TODO(api): vienen del historial. */
export function historyRows(project: Project): HistoryRun[] {
  const rows: HistoryRun[] = project.id === "pedidos" ? [...SAMPLE_HISTORY] : [];
  const report = project.report;
  if (report && !rows.some((r) => r.number === report.runNumber))
    rows.push({
      number: report.runNumber,
      date: `${report.date}T12:00:00Z`,
      kind: "full",
      modules: report.modulesRun,
      state: "completed",
      duration: report.minutes,
      requests: report.requests,
      severities: report.severities,
      changes: null,
    });
  if (project.running !== undefined) {
    const found = SEED_FINDINGS.slice(0, Math.min(6, Math.round((project.running / 58) * 6)));
    rows.push({
      number: (report?.runNumber ?? 0) + 1,
      date: new Date().toISOString(),
      kind: "full",
      modules: 4,
      state: "running",
      duration: "—",
      requests: Math.round((project.running / 100) * 2000),
      severities: SEVERITIES.map(
        (s) => found.filter((f) => f.severity === s).length,
      ) as HistoryRun["severities"],
      changes: null,
    });
  }
  return rows.sort((a, b) => b.number - a.number);
}

function History({ project }: { project: Project }) {
  const t = useTranslations("History");
  const ts = useTranslations("Severity");
  const format = useFormatter();
  const base = `/projects/${project.id}`;
  const rows = historyRows(project);
  const running = rows.find((r) => r.state === "running");
  const openNow = project.openFindings ?? 0;
  const bars = [...rows].reverse();
  const max = Math.max(1, ...bars.map((r) => r.severities.reduce((a, b) => a + b, 0)));

  if (rows.length === 0)
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
      timeZone: "UTC",
    });

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-5">
        <section
          aria-labelledby="st-h"
          className="border-line flex min-w-[300px] flex-[1_1_340px] flex-col gap-3.5 rounded-[28px] border bg-[image:var(--hero)] p-7"
        >
          <span className="border-line bg-panel-2 inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[13px] font-semibold">
            <Icon name="refresh" size={14} className="text-accent" strokeWidth={2.4} />
            {project.concluded ? t("concluded.badge") : t("following")}
          </span>
          <h2
            id="st-h"
            className="font-display text-4xl leading-none font-medium tracking-[-0.03em]"
          >
            {project.concluded ? t("concluded.title") : t("notConcluded")}
          </h2>
          <p className="text-muted text-[14.5px] leading-[1.55]">
            {project.concluded ? t("concluded.text") : t("rule")}
          </p>
          <dl className="border-line bg-panel-2 m-0 grid grid-cols-2 gap-3 rounded-[20px] border px-[18px] py-4">
            {[
              [openNow, t("openNow")],
              [RESOLVED_TOTAL[project.id] ?? 0, t("resolvedTotal")],
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
                  r.state === "running"
                    ? t("chart.itemRunning", {
                        number: r.number,
                        count: r.severities.reduce((a, b) => a + b, 0),
                      })
                    : t("chart.item", {
                        number: r.number,
                        count: r.severities.reduce((a, b) => a + b, 0),
                      }),
                )
                .join("; "),
            })}
            className="border-line-strong flex h-[220px] items-end gap-6 border-b px-2"
          >
            {bars.map((r) => {
              const value = r.severities.reduce((a, b) => a + b, 0);
              return (
                <div
                  key={r.number}
                  title={t("chart.tip", { number: r.number, count: value })}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-sm font-bold tabular-nums">
                    {value}
                    {r.state === "running" ? "*" : ""}
                  </span>
                  <span
                    className={cn(
                      "border-accent w-full max-w-[72px] rounded-t border",
                      r.state === "running" ? "border-dashed bg-transparent" : "bg-accent",
                    )}
                    style={{ height: `${Math.max(4, Math.round((value / max) * 160))}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div aria-hidden="true" className="flex gap-6 px-2">
            {bars.map((r) => (
              <span key={r.number} className="text-muted flex-1 text-center text-[13px]">
                {r.state === "running"
                  ? t("chart.labelRunning", { number: r.number })
                  : t("chart.label", { number: r.number })}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section aria-labelledby="ej-h" className={cn(card, "gap-2 overflow-x-auto")}>
        <h2 id="ej-h" className="text-lg font-semibold">
          {t("runs", { count: rows.length })}
        </h2>
        <div aria-hidden="true" className={cn(GRID, "text-muted px-4 text-[12.5px]")}>
          <span>{t("cols.run")}</span>
          <span>{t("cols.date")}</span>
          <span>{t("cols.status")}</span>
          <span>{t("cols.duration")}</span>
          <span>{t("cols.requests")}</span>
          <span>{t("cols.severity")}</span>
          <span>{t("cols.changes")}</span>
          <span />
        </div>
        <ul className="m-0 flex min-w-[1060px] list-none flex-col gap-1.5 p-0">
          {rows.map((r) => (
            <li
              key={r.number}
              className={cn(
                GRID,
                "bg-panel-2 rounded-[18px] border px-4 py-3",
                r.state === "running" ? "border-accent/55" : "border-line",
              )}
            >
              <b className="font-display text-xl font-medium">
                {t("number", { number: r.number })}
              </b>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{date(r.date)}</span>
                <span className="text-muted text-[12.5px]">
                  {r.kind === "auth" ? t("kind.auth") : t("kind.full", { count: r.modules })}
                  {r.pendingResources ? ` · ${t("pending", { count: r.pendingResources })}` : ""}
                </span>
              </span>
              <span>
                <StatusBadge kind="run" status={r.state} />
              </span>
              <span className="text-sm tabular-nums">{r.duration}</span>
              <span className="text-sm tabular-nums">{format.number(r.requests)}</span>
              <span className="flex gap-2.5 text-[13px] tabular-nums">
                {r.severities.map((n, i) => (
                  <span key={SEVERITIES[i]} className="inline-flex items-center gap-1">
                    <span aria-hidden="true" className={cn("size-2 rounded-sm", SEV_BG[i])} />
                    <span className="sr-only">{ts(SEVERITIES[i])} </span>
                    {n}
                  </span>
                ))}
              </span>
              <span className="text-muted text-[13.5px] tabular-nums">
                {r.changes ? r.changes.join(" · ") : "—"}
              </span>
              <span className="flex justify-end gap-1.5">
                <ButtonLink
                  href={r.state === "running" ? `${base}/runs/current` : `${base}/runs/${r.number}`}
                  variant="secondary"
                  className="min-h-10 rounded-xl px-3 text-sm"
                >
                  {r.state === "running" ? t("viewProgress") : t("open")}
                </ButtonLink>
                {r.state !== "running" ? (
                  <ButtonLink
                    href={`${base}/runs/${r.number}/report`}
                    variant="secondary"
                    className="min-h-10 rounded-xl px-3 text-sm"
                  >
                    {t("report")}
                  </ButtonLink>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Repetir la última ejecución con la misma configuración, en un solo paso (RF-71). */
function RepeatAction({ project }: { project: Project }) {
  const t = useTranslations("History");
  const toast = useToast();
  const router = useRouter();
  if (!project.verified || !project.report) return null;
  if (project.running !== undefined)
    return (
      <ButtonLink href={`/projects/${project.id}/runs/current`} variant="secondary">
        {t("viewProgress")}
      </ButtonLink>
    );
  return (
    <Button
      onClick={() => {
        updateProject(project.id, { running: 0 });
        toast.show({
          type: "info",
          title: t("repeatStarted", { number: (project.report?.runNumber ?? 0) + 1 }),
        });
        router.push(`/projects/${project.id}/runs/current`);
      }}
    >
      <Icon name="refresh" size={18} />
      {t("repeat")}
    </Button>
  );
}

/** V-31. Historial: evolución de hallazgos abiertos y todas las ejecuciones (RF-71 a RF-73). */
export function HistoryView({ id }: { id: string }) {
  const t = useTranslations("History");
  return (
    <ProjectShell
      id={id}
      section={t("title")}
      title={t("title")}
      actions={(project) => <RepeatAction project={project} />}
    >
      {(project) => <History project={project} />}
    </ProjectShell>
  );
}
