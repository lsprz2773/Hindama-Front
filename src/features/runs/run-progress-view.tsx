"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Banner } from "@/components/ui/banner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SeverityMeter, SEVERITIES } from "@/components/ui/severity";
import { EmptyState } from "@/components/ui/state-view";
import { useToast } from "@/components/ui/toast";
import { useIsClient } from "@/features/account/browser-store";
import { ProjectShell } from "@/features/projects/project-shell";
import { updateProject, type Project } from "@/features/projects/store";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { DEFAULT_REPORT, SEED_FINDINGS } from "./data";

const MODULES = [
  { code: "API2", key: "auth", from: 0 },
  { code: "API8", key: "config", from: 25 },
  { code: "API1", key: "objects", from: 50 },
  { code: "API3", key: "properties", from: 75 },
] as const;
const TICK_MS = 1000;
const TICK_STEP = 3;

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Progress({ project }: { project: Project }) {
  const t = useTranslations("RunProgress");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  const router = useRouter();
  const toast = useToast();
  const base = `/projects/${project.id}`;
  const [percent, setPercent] = useState(project.running ?? 0);
  const [cancelling, setCancelling] = useState(false);
  const done = percent >= 100;
  // Se fija al abrir: al terminar, el reporte del proyecto ya incluye esta ejecución.
  const [runNumber] = useState((project.report?.runNumber ?? 0) + 1);

  // Simulación del avance en vivo. TODO(api): sondeo o tiempo real según el contrato de ejecuciones.
  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(
      () => setPercent((p) => Math.min(100, p + TICK_STEP)),
      TICK_MS,
    );
    return () => window.clearInterval(timer);
  }, [done]);

  useEffect(() => {
    if (done && project.running !== undefined) {
      const today = new Date().toISOString().slice(0, 10);
      // TODO(api): el reporte lo entrega la ejecución terminada.
      updateProject(project.id, {
        running: undefined,
        lastRun: today,
        report: { ...(project.report ?? DEFAULT_REPORT), runNumber, date: today },
      });
      toast.show({ type: "success", title: t("finished", { number: runNumber }) });
    }
  }, [done, project.id, project.running, project.report, runNumber, t, toast]);

  const found = SEED_FINDINGS.slice(0, Math.min(6, Math.round((percent / 58) * 6)));
  const counts = SEVERITIES.map((s) => found.filter((f) => f.severity === s).length);
  const requests = Math.round((percent / 100) * 2000);
  const seconds = Math.round((percent / 100) * 14 * 60);
  const current = MODULES.filter((m) => percent >= m.from).at(-1) ?? MODULES[0];

  return (
    <>
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
                className={cn("bg-accent size-[9px] rounded-full", !done && "animate-pulse")}
              />
              {done ? t("completed") : t("live")}
            </span>
            <span className="text-muted text-sm">
              {t("started", { time: "11:02", modules: MODULES.length })}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {!done ? (
              <span className="text-muted text-[15px]">
                {t.rich("now", {
                  module: tm(`names.${current.key}`),
                  b: (chunks) => <b className="text-fg">{chunks}</b>,
                })}
              </span>
            ) : null}
            <h2
              id="run-percent"
              className="font-display text-7xl leading-none font-medium tracking-[-0.03em] tabular-nums sm:text-[96px]"
            >
              {percent} %
            </h2>
          </div>
          <div
            role="progressbar"
            aria-label={t("progressLabel")}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="bg-track h-3.5 overflow-hidden rounded-lg"
          >
            <div
              className="bg-accent h-full rounded-lg transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <dl className="border-line bg-panel-2 m-0 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4 rounded-[22px] border px-[22px] py-[18px]">
            {[
              [requests.toLocaleString("en-US"), t("stats.requests")],
              [clock(seconds), t("stats.minutes")],
              ["5 req/s", t("stats.speed")],
            ].map(([value, label]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-muted order-2 text-[13px]">{label}</dt>
                <dd className="font-display order-1 m-0 text-[30px] leading-none font-medium tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {done ? (
            <ButtonLink href={`${base}/runs/${runNumber}`} size="lg" className="self-start">
              {t("viewResults")}
            </ButtonLink>
          ) : (
            <Button
              variant="secondary"
              className="text-danger border-danger self-start bg-transparent"
              onClick={() => setCancelling(true)}
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
            {t("found", { count: found.length })}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {SEVERITIES.map((s, i) => (
              <li
                key={s}
                className="grid grid-cols-[92px_minmax(0,1fr)_28px] items-center gap-3 text-sm"
              >
                <span>{ts(s)}</span>
                <SeverityMeter severity={s} />
                <b className="text-right tabular-nums">{counts[i]}</b>
              </li>
            ))}
          </ul>
          {found.length > 0 ? (
            <div className="border-line flex flex-col gap-2 border-t pt-3.5">
              <span className="text-muted text-[13px]">{t("recent")}</span>
              {found.slice(0, 3).map((f) => (
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

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="run-modules"
          className="border-line bg-panel flex min-w-0 flex-[999_1_520px] flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
        >
          <h2 id="run-modules" className="text-lg font-semibold">
            {t("modules")}
          </h2>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {MODULES.map((m) => {
              const progress = Math.max(0, Math.min(100, ((percent - m.from) / 25) * 100));
              const active = progress > 0 && progress < 100;
              return (
                <li
                  key={m.key}
                  className={cn(
                    "bg-panel-2 flex flex-wrap items-center gap-4 rounded-[20px] border px-4 py-3",
                    active ? "border-accent/55" : "border-line",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "font-display inline-flex size-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold",
                      active ? "bg-accent text-on-accent" : "bg-progress-bg text-accent",
                    )}
                  >
                    {m.code}
                  </span>
                  <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                    <span className="text-[15px] font-semibold">{tm(`names.${m.key}`)}</span>
                    <span
                      aria-hidden="true"
                      className="bg-track block h-1.5 overflow-hidden rounded"
                    >
                      <span
                        className={cn(
                          "block h-full rounded",
                          progress === 100 ? "bg-success" : "bg-accent",
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </span>
                  </div>
                  <span className="text-muted w-44 text-right text-sm">
                    {progress === 100
                      ? t("moduleDone", { count: found.filter((f) => f.module === m.key).length })
                      : active
                        ? t("moduleRunning", { percent: Math.round(progress) })
                        : t("modulePending")}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="run-notices"
          aria-live="polite"
          className="border-line bg-panel flex min-w-[280px] flex-[1_1_320px] flex-col gap-3 rounded-[28px] border p-6 backdrop-blur-lg"
        >
          <h2 id="run-notices" className="text-lg font-semibold">
            {t("notices.title")}
          </h2>
          <Banner
            title={t("notices.expired.title", { name: "Cliente B" })}
            action={
              <Link href={`${base}/identities`} className="text-link">
                {t("notices.expired.action")}
              </Link>
            }
          >
            {t("notices.expired.text")}
          </Banner>
          <Banner tone="info" icon="lock" title={t("notices.blocked.title", { count: 3 })}>
            {t.rich("notices.blocked.text", {
              code: (chunks) => <code className="font-mono">{chunks}</code>,
            })}
          </Banner>
        </section>
      </div>

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t("cancelDialog.title", { number: runNumber })}
        description={t("cancelDialog.text", { count: found.length })}
        confirmLabel={t("cancelDialog.confirm")}
        cancelLabel={t("cancelDialog.keep")}
        danger
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 400)); // TODO(api): cancelar la ejecución
          updateProject(project.id, { running: undefined });
          toast.show({ type: "warning", title: t("cancelled", { number: runNumber }) });
          router.push(base);
        }}
      />
    </>
  );
}

/** Solo muestra el avance si la ejecución estaba en curso al abrir; al terminar sigue visible. */
function Gate({ project }: { project: Project }) {
  const client = useIsClient();
  // Hasta hidratar, el proyecto es el de ejemplo: se espera al estado real del navegador.
  return client ? <GateInner project={project} /> : null;
}

function GateInner({ project }: { project: Project }) {
  const t = useTranslations("RunProgress");
  const [wasRunning] = useState(project.running !== undefined);
  return wasRunning ? (
    <Progress project={project} />
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
    >
      {(project) => <Gate key={project.id} project={project} />}
    </ProjectShell>
  );
}
