"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { Banner } from "@/components/ui/banner";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SeverityMeter, SEVERITIES } from "@/components/ui/severity";
import { BlockedAction, EmptyState } from "@/components/ui/state-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import type { ModuleAvailability, Project } from "@/lib/api/schemas/projects";
import { cn } from "@/lib/cn";
import { MODULE_VIEW } from "@/features/runs/modules";
import { RerunButton } from "@/features/runs/rerun-button";
import { hasActiveRun, ProjectShell } from "./project-shell";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";

const MODULES = MODULE_VIEW;

type Missing = ModuleAvailability["missing"][number];

/** Duración `m:ss` entre el inicio y el fin de la ejecución. */
function duration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const seconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Dashboard({ project }: { project: Project }) {
  const t = useTranslations("Dashboard");
  const ts = useTranslations("Severity");
  const format = useFormatter();
  const base = `/projects/${project.id}`;
  const verified = project.verification_status === "verified";
  const active = hasActiveRun(project);
  const run = project.last_run;
  const open = project.open_findings_by_severity;
  const policyPending = project.modules.some((m) => m.missing.includes("policy_unconfirmed"));

  /** Motivo de cada requisito que falta y dónde se resuelve (C-13). */
  const blockFor = (missing: Missing) =>
    ({
      project_not_verified: {
        reason: t("blocked.unverified"),
        label: t("blocked.goVerify"),
        href: `${base}/verification`,
      },
      no_contract: {
        reason: t("blocked.noContract"),
        label: t("blocked.goContract"),
        href: `${base}/contract`,
      },
      insufficient_identities: {
        reason: t("blocked.identities"),
        label: t("blocked.addIdentity"),
        href: `${base}/identities/new`,
      },
      no_admin_identity: {
        reason: t("modules.blocked"),
        label: t("modules.addIdentity"),
        href: `${base}/identities`,
      },
      no_resources: {
        reason: t("blocked.resources"),
        label: t("blocked.goResources"),
        href: `${base}/resources`,
      },
      policy_unconfirmed: {
        reason: t("blocked.policyPending"),
        label: t("blocked.reviewPolicy"),
        href: `${base}/policy`,
      },
    })[missing];

  const minutes = run ? duration(run.started_at, run.finished_at) : null;
  const stats = run
    ? [
        [format.number(run.requests_sent), t("stats.requests")],
        ...(minutes ? [[minutes, t("stats.minutes")]] : []),
        [`${run.modules.length} / 7`, t("stats.modules")],
        [`n.º ${run.number}`, t("stats.lastRun")],
      ]
    : [];

  return (
    <>
      {active ? (
        <Banner
          tone="info"
          title={t("running.title")}
          action={
            <Link href={`${base}/runs/current`} className="text-link">
              {t("running.action")}
            </Link>
          }
        >
          {t("running.textActive")}
        </Banner>
      ) : null}
      {!verified ? (
        <Banner
          title={t("unverified.title")}
          action={
            <Link href={`${base}/verification`} className="text-link">
              {t("unverified.action")}
            </Link>
          }
        >
          {t("unverified.text")}
        </Banner>
      ) : null}
      <ApiWarnings warnings={project.warnings} />

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="dash-hero"
          className="border-line flex min-w-0 flex-[999_1_560px] flex-col gap-[18px] rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-8"
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge kind="project" status={verified ? "verified" : "pendingVerification"} />
            {project.concluded ? <StatusBadge kind="project" status="concluded" /> : null}
            <span className="text-muted inline-flex items-center gap-2 px-1 text-[13px]">
              <Icon name="globe" size={14} />
              {project.host}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <h2
              id="dash-hero"
              className="font-display text-[40px] leading-[1.05] font-medium tracking-[-0.03em] sm:text-5xl"
            >
              {run ? t("hero.open", { count: open.total }) : t("hero.none")}
            </h2>
            <p className="text-muted max-w-[56ch] text-base leading-[1.55]">
              {!run
                ? t("hero.noneText")
                : open.critical > 0
                  ? t("hero.criticalOpen", { count: open.critical })
                  : open.total === 0
                    ? t("hero.cleanText")
                    : t("hero.text")}
            </p>
          </div>

          {!verified ? (
            <BlockedAction
              label={t("fullTest")}
              reason={t("blocked.unverified")}
              linkLabel={t("blocked.goVerify")}
              href={`${base}/verification`}
            />
          ) : !project.current_contract ? (
            <BlockedAction
              label={t("fullTest")}
              reason={t("blocked.noContract")}
              linkLabel={t("blocked.goContract")}
              href={`${base}/contract`}
            />
          ) : active ? (
            <BlockedAction
              label={t("fullTest")}
              reason={t("blocked.active")}
              linkLabel={t("blocked.viewRun")}
              href={`${base}/runs/current`}
            />
          ) : (
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={`${base}/runs/new`} size="lg">
                <Icon name="play" size={16} />
                {t("fullTest")}
              </ButtonLink>
              {run ? (
                <RerunButton project={project} run={run} label={t("repeat")} variant="secondary" />
              ) : null}
            </div>
          )}

          {stats.length > 0 ? (
            <dl className="stagger m-0 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-4">
              {stats.map(([value, label]) => (
                <div
                  key={label}
                  className="border-line bg-panel-2 flex flex-col gap-1 rounded-[20px] border px-4 py-3.5"
                >
                  <dt className="text-muted order-2 text-[13px]">{label}</dt>
                  <dd className="font-display order-1 m-0 text-[26px] leading-none font-medium tracking-[-0.03em] tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>

        <div className="flex min-w-[280px] flex-[1_1_300px] flex-col gap-5">
          <section aria-labelledby="dash-sev" className={card}>
            <h2 id="dash-sev" className="text-lg font-semibold">
              {t("severity.title")}
            </h2>
            {run ? (
              <>
                <ul className="stagger m-0 flex list-none flex-col gap-3 p-0">
                  {SEVERITIES.map((sev) => (
                    <li key={sev} className="flex items-center gap-3 text-sm">
                      <span className="w-[88px] flex-none">{ts(sev)}</span>
                      <SeverityMeter severity={sev} barClassName="w-4" className="flex-1" />
                      <b className="tabular-nums">{open[sev]}</b>
                    </li>
                  ))}
                </ul>
                <Link href={`${base}/findings`} className="text-link text-[15px] font-bold">
                  {t("severity.viewAll", { count: open.total })}
                </Link>
              </>
            ) : (
              <p className="text-muted text-sm">{t("severity.empty")}</p>
            )}
          </section>

          <section aria-labelledby="dash-pol" className={card}>
            <h2 id="dash-pol" className="text-lg font-semibold">
              {t("policy.title")}
            </h2>
            {/* TODO(api): `Project` no trae cuántas operaciones están confirmadas; el porcentaje
                vuelve cuando se conecte la política (fase 4). */}
            <p className="text-muted text-sm leading-[1.5]">
              {!project.current_contract
                ? t("policy.empty")
                : policyPending
                  ? t("policy.pendingText")
                  : t("policy.confirmedText")}
            </p>
            <Link href={`${base}/policy`} className="text-link text-[15px] font-bold">
              {t("policy.review")}
            </Link>
          </section>
        </div>
      </div>

      <section aria-labelledby="dash-mod" className={cn(card, "gap-5 p-6 sm:p-8")}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="dash-mod" className="text-lg font-semibold">
            {t("modules.title")}
          </h2>
          {run?.finished_at ? (
            <span className="text-muted text-sm">
              {t("modules.results", {
                number: run.number,
                date: format.dateTime(new Date(run.finished_at), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
              })}
            </span>
          ) : null}
        </div>
        {project.modules.length > 0 ? (
          <ul className="stagger m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-2.5 p-0">
            {project.modules.map((m) => {
              const { key, code } = MODULES[m.module];
              const block = m.available ? null : blockFor(m.missing[0] ?? "project_not_verified");
              const ran = run?.modules.includes(m.module) ?? false;
              return (
                <li
                  key={m.module}
                  className="border-line bg-panel-2 flex flex-wrap items-center gap-3.5 rounded-[20px] border p-4"
                >
                  <span
                    aria-hidden="true"
                    className="bg-progress-bg text-accent font-display inline-flex size-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold"
                  >
                    {code}
                  </span>
                  <div className="flex min-w-0 flex-[1_1_160px] flex-col">
                    <span className="text-[15px] font-semibold">{t(`modules.names.${key}`)}</span>
                    <span className={cn("text-[13px]", block ? "text-warning" : "text-muted")}>
                      {block ? block.reason : t(`modules.notes.${key}`)}
                    </span>
                  </div>
                  {/* TODO(api): los hallazgos por módulo llegan con la ejecución (fase 5). */}
                  <span className="text-muted text-[13px] whitespace-nowrap">
                    {ran ? t("modules.ran") : t("modules.notRun")}
                  </span>
                  {block ? (
                    <ButtonLink href={block.href} variant="ghost" size="sm" className="px-2">
                      {block.label}
                    </ButtonLink>
                  ) : !active ? (
                    <ButtonLink
                      href={`${base}/runs/new?module=${key}`}
                      variant="secondary"
                      size="sm"
                      aria-label={t("modules.runTitle", { name: t(`modules.names.${key}`) })}
                    >
                      {t("modules.run")}
                    </ButtonLink>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title={t("modules.emptyTitle")} text={t("modules.emptyText")} />
        )}
      </section>
    </>
  );
}

/** V-16. Dashboard del proyecto (`getProject`): estado, hallazgos, política y módulos. */
export function DashboardView({ id }: { id: string }) {
  return (
    <ProjectShell
      id={id}
      title={(project) => project.name}
      render={(project) => <Dashboard project={project} />}
    />
  );
}
