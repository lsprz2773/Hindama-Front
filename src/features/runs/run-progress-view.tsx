"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { DetailSkeleton } from "@/components/skeletons/page-skeletons";
import { Banner } from "@/components/ui/banner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { QueryState } from "@/components/ui/query-state";
import { SeverityMeter, SEVERITIES } from "@/components/ui/severity";
import { EmptyState } from "@/components/ui/state-view";
import { useToast } from "@/components/ui/toast";
import { hasActiveRun, ProjectShell } from "@/features/projects/project-shell";
import { Link } from "@/i18n/navigation";
import type { Project } from "@/lib/api/schemas/projects";
import type { Run } from "@/lib/api/schemas/runs";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { FailedResources } from "./failed-resources";
import { cancelRun, useAfterRun, useFindings, useRun, useRunStream } from "./api";
import { MODULE_VIEW } from "./modules";

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const isActive = (run: Run) => run.status === "queued" || run.status === "running";

function Progress({
  project,
  run,
  live,
}: {
  project: Project;
  run: Run;
  live: "open" | "error" | "connecting" | "ended";
}) {
  const t = useTranslations("RunProgress");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  const format = useFormatter();
  const now = useNow({ updateInterval: 1000 });
  const toast = useToast();
  const http = useHttpClient();
  const afterRun = useAfterRun(project.id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const base = `/projects/${project.id}`;
  const active = isActive(run);
  const progress = run.progress;
  const counts = progress.findings_by_severity;
  const recent = useFindings(project.id, { runId: run.id, pageSize: 3 });
  const { refetch } = recent;

  // Los hallazgos más recientes se vuelven a pedir cuando el progreso informa uno nuevo.
  useEffect(() => {
    void refetch();
  }, [counts.total, refetch]);

  const started = run.started_at ? Date.parse(run.started_at) : null;
  const end = run.finished_at ? Date.parse(run.finished_at) : now.getTime();
  const seconds = started ? Math.max(0, Math.round((end - started) / 1000)) : 0;
  const currentIndex = progress.current_module ? run.modules.indexOf(progress.current_module) : -1;

  return (
    <>
      {live === "error" && active ? (
        <Banner title={t("lost.title")} tone="info">
          {t("lost.text")}
        </Banner>
      ) : null}
      <FailedResources projectId={project.id} items={run.created_resources.failed_items} />

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="run-percent"
          className="border-line flex min-w-0 flex-[999_1_560px] flex-col gap-6 rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              role="status"
              className="border-line bg-panel-2 inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold"
            >
              <span
                aria-hidden="true"
                className={cn("bg-accent size-[9px] rounded-full", active && "animate-pulse")}
              />
              {run.cancel_requested_at && active ? t("cancelling") : t(`status.${run.status}`)}
            </span>
            <span className="text-muted text-sm">
              {run.started_at
                ? t("started", {
                    time: format.dateTime(new Date(run.started_at), { timeStyle: "short" }),
                    modules: run.modules.length,
                  })
                : t("queuedAt", { modules: run.modules.length })}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {progress.current_module ? (
              <span className="text-muted text-[15px]">
                {t.rich("now", {
                  module: tm(`names.${MODULE_VIEW[progress.current_module].key}`),
                  b: (chunks) => <b className="text-fg">{chunks}</b>,
                })}
              </span>
            ) : null}
            <h2
              id="run-percent"
              className="font-display text-7xl leading-none font-medium tracking-[-0.03em] tabular-nums sm:text-[96px]"
            >
              {progress.percent} %
            </h2>
          </div>
          <div
            role="progressbar"
            aria-label={t("progressLabel")}
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="bg-track h-3.5 overflow-hidden rounded-lg"
          >
            <div
              className="bg-accent h-full rounded-lg transition-[width] duration-700 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <dl className="border-line bg-panel-2 m-0 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4 rounded-[22px] border px-[22px] py-[18px]">
            {[
              [format.number(progress.requests_sent), t("stats.requests")],
              [clock(seconds), t("stats.minutes")],
              [
                t("stats.cells", {
                  done: progress.cells_evaluated,
                  total: progress.cells_planned,
                }),
                t("stats.cellsLabel"),
              ],
              [`${run.limits.requests_per_second} req/s`, t("stats.speed")],
            ].map(([value, label]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-muted order-2 text-[13px]">{label}</dt>
                <dd className="font-display order-1 m-0 text-[30px] leading-none font-medium tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {!active ? (
            <ButtonLink href={`${base}/runs/${run.id}`} size="lg" className="self-start">
              {t("viewResults")}
            </ButtonLink>
          ) : (
            <Button
              variant="secondary"
              className="text-danger border-danger self-start bg-transparent"
              disabled={run.cancel_requested_at !== null}
              onClick={() => setConfirmCancel(true)}
            >
              <Icon name="stop" size={16} />
              {t("cancel")}
            </Button>
          )}
        </section>

        <section
          aria-labelledby="run-found"
          className="border-line bg-panel flex min-w-[280px] flex-[1_1_320px] flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
        >
          <h2 id="run-found" className="text-lg font-semibold">
            {t("found", { count: counts.total })}
          </h2>
          <ul className="stagger m-0 flex list-none flex-col gap-3 p-0">
            {SEVERITIES.map((s) => (
              <li
                key={s}
                className="grid grid-cols-[92px_minmax(0,1fr)_28px] items-center gap-3 text-sm"
              >
                <span>{ts(s)}</span>
                <SeverityMeter severity={s} />
                <b className="text-right tabular-nums">{counts[s]}</b>
              </li>
            ))}
          </ul>
          {recent.data && recent.data.items.length > 0 ? (
            <div className="border-line flex flex-col gap-2 border-t pt-3.5">
              <span className="text-muted text-[13px]">{t("recent")}</span>
              {recent.data.items.map((f) => (
                <Link
                  key={f.id}
                  href={`${base}/findings/${f.id}`}
                  className="bg-panel-2 text-fg flex flex-col gap-0.5 rounded-[14px] px-3 py-2.5 no-underline"
                >
                  <span className="text-[12.5px] font-bold">{ts(f.severity)}</span>
                  <span className="text-sm">{f.title}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">{t("noneYet")}</p>
          )}
        </section>
      </div>

      <section
        aria-labelledby="run-modules"
        className="border-line bg-panel flex min-w-0 flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <h2 id="run-modules" className="text-lg font-semibold">
          {t("modules")}
        </h2>
        {/* TODO(api): `RunProgress` no trae el avance ni los hallazgos de cada módulo. */}
        <ol className="stagger m-0 flex list-none flex-col gap-2 p-0">
          {run.modules.map((m, i) => {
            const view = MODULE_VIEW[m];
            const state =
              i === currentIndex
                ? "running"
                : !active || (currentIndex >= 0 && i < currentIndex)
                  ? "done"
                  : "pending";
            return (
              <li
                key={m}
                className={cn(
                  "bg-panel-2 flex flex-wrap items-center gap-4 rounded-[20px] border px-4 py-3",
                  state === "running" ? "border-accent/55" : "border-line",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-display inline-flex size-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold",
                    state === "running" ? "bg-accent text-on-accent" : "bg-progress-bg text-accent",
                  )}
                >
                  {view.code}
                </span>
                <span className="min-w-[200px] flex-1 text-[15px] font-semibold">
                  {tm(`names.${view.key}`)}
                </span>
                <span className="text-muted w-44 text-right text-sm">
                  {state === "done"
                    ? t("moduleDone")
                    : state === "running"
                      ? t("moduleRunning")
                      : t("modulePending")}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("cancelDialog.title", { number: run.number })}
        description={t("cancelDialog.text", { count: counts.total })}
        confirmLabel={t("cancelDialog.confirm")}
        cancelLabel={t("cancelDialog.keep")}
        danger
        mapError={(error) =>
          error instanceof ApiError && error.code === "run.not_active"
            ? { title: t("errors.notActive") }
            : error instanceof ApiError && error.requestId
              ? { title: t("errors.failed"), text: t("errors.reference", { id: error.requestId }) }
              : { title: t("errors.failed") }
        }
        onConfirm={async () => {
          const updated = await cancelRun(http, project.id, run.id);
          afterRun(updated);
          toast.show({ type: "warning", title: t("cancelRequested", { number: run.number }) });
        }}
      />
    </>
  );
}

function Live({ project, runId }: { project: Project; runId: string }) {
  const t = useTranslations("RunProgress");
  const toast = useToast();
  const query = useRun(project.id, runId);
  const stream = useRunStream(project.id, runId, query.data);
  const ended = stream.state === "ended" ? stream.run : null;

  useEffect(() => {
    if (!ended) return;
    toast.show(
      ended.status === "completed"
        ? { type: "success", title: t("finished", { number: ended.number }) }
        : {
            type: "warning",
            title: t(`ended.${ended.status === "cancelled" ? "cancelled" : "failed"}`, {
              number: ended.number,
            }),
          },
    );
  }, [ended, t, toast]);

  return (
    <QueryState query={query} subject={t("subject")} skeleton={<DetailSkeleton />}>
      {(run) => <Progress project={project} run={run} live={stream.state} />}
    </QueryState>
  );
}

/** La ejecución activa es siempre la última del proyecto (`last_run`); se queda fija al terminar. */
function Gate({ project }: { project: Project }) {
  const t = useTranslations("RunProgress");
  const candidate = hasActiveRun(project) ? (project.last_run?.id ?? null) : null;
  const [pinned, setPinned] = useState<string | null>(candidate);
  // Al terminar deja de ser activa, pero la vista sigue mostrándola.
  if (candidate && candidate !== pinned) setPinned(candidate);
  const runId = pinned;
  return runId ? (
    <Live project={project} runId={runId} />
  ) : (
    <EmptyState
      title={t("none.title")}
      text={t("none.text")}
      action={{ label: t("none.action"), href: `/projects/${project.id}/runs/new` }}
    />
  );
}

/** V-26. Ejecución en curso: progreso en vivo, hallazgos que van apareciendo y cancelación (RF-51 a RF-53). */
export function RunProgressView({ id }: { id: string }) {
  const t = useTranslations("RunProgress");
  return (
    <ProjectShell
      id={id}
      trail={[{ label: t("crumbHistory"), href: `/projects/${id}/history` }, { label: t("crumb") }]}
      title={t("title")}
      render={(project) => <Gate key={project.id} project={project} />}
    />
  );
}
