"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Banner } from "@/components/ui/banner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SeverityMeter, SEVERITIES } from "@/components/ui/severity";
import { BlockedAction, EmptyState } from "@/components/ui/state-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { cn } from "@/lib/cn";
import { ProjectShell } from "./project-shell";
import { hostOf, type Project } from "./store";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";

function Dashboard({ project }: { project: Project }) {
  const t = useTranslations("Dashboard");
  const ts = useTranslations("Severity");
  const format = useFormatter();
  const toast = useToast();
  const base = `/projects/${project.id}`;
  const report = project.report;
  const open = project.openFindings;
  const insecure = project.baseUrl.startsWith("http:");

  const stats = report
    ? [
        [format.number(report.requests), t("stats.requests")],
        [report.minutes, t("stats.minutes")],
        [`${report.modulesRun} / 7`, t("stats.modules")],
        [`n.º ${report.runNumber}`, t("stats.lastRun")],
      ]
    : [];

  return (
    <>
      {project.running !== undefined ? (
        <Banner
          tone="info"
          title={t("running.title")}
          action={
            <Link href={`${base}/runs/current`} className="text-link">
              {t("running.action")}
            </Link>
          }
        >
          {t("running.text", { percent: project.running })}
        </Banner>
      ) : null}
      {!project.verified ? (
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
      {insecure ? <ApiWarnings warnings={[{ code: "url.no_tls" }]} /> : null}

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="dash-hero"
          className="border-line flex min-w-0 flex-[999_1_560px] flex-col gap-[18px] rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-8"
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              kind="project"
              status={project.verified ? "verified" : "pendingVerification"}
            />
            {project.concluded ? <StatusBadge kind="project" status="concluded" /> : null}
            <span className="text-muted inline-flex items-center gap-2 px-1 text-[13px]">
              <Icon name="globe" size={14} />
              {hostOf(project.baseUrl)}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <h2
              id="dash-hero"
              className="font-display text-[40px] leading-[1.05] font-medium tracking-[-0.03em] sm:text-5xl"
            >
              {open === null ? t("hero.none") : t("hero.open", { count: open })}
            </h2>
            <p className="text-muted max-w-[56ch] text-base leading-[1.55]">
              {open === null
                ? t("hero.noneText")
                : report?.criticalNote
                  ? t("hero.criticalText")
                  : open === 0
                    ? t("hero.cleanText")
                    : t("hero.text")}
            </p>
          </div>

          {project.verified ? (
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={`${base}/runs/new`} size="lg">
                <Icon name="play" size={16} />
                {t("fullTest")}
              </ButtonLink>
              {report ? (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() =>
                    toast.show({ type: "info", title: t("repeat.title"), text: t("repeat.text") })
                  }
                >
                  {t("repeat.button")}
                </Button>
              ) : null}
            </div>
          ) : (
            <BlockedAction
              label={t("fullTest")}
              reason={t("blocked.unverified")}
              linkLabel={t("blocked.goVerify")}
              href={`${base}/verification`}
            />
          )}

          {stats.length > 0 ? (
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-4">
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
            {report ? (
              <>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {SEVERITIES.map((sev, i) => (
                    <li key={sev} className="flex items-center gap-3 text-sm">
                      <span className="w-[88px] flex-none">{ts(sev)}</span>
                      <SeverityMeter severity={sev} barClassName="w-4" className="flex-1" />
                      <b className="tabular-nums">{report.severities[i]}</b>
                    </li>
                  ))}
                </ul>
                <Link href={`${base}/findings`} className="text-link text-[15px] font-bold">
                  {t("severity.viewAll", { count: open ?? 0 })}
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
            {project.policy ? (
              <>
                <span className="font-display text-4xl leading-none font-medium tabular-nums">
                  {Math.round((project.policy.confirmed / project.policy.total) * 100)} %
                </span>
                <span
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(
                    (project.policy.confirmed / project.policy.total) * 100,
                  )}
                  aria-label={t("policy.title")}
                  className="bg-track block h-2 overflow-hidden rounded"
                >
                  <span
                    className="bg-accent block h-full rounded"
                    style={{ width: `${(project.policy.confirmed / project.policy.total) * 100}%` }}
                  />
                </span>
                <p className="text-muted text-sm leading-[1.5]">
                  {t("policy.text", {
                    confirmed: project.policy.confirmed,
                    total: project.policy.total,
                    pending: project.policy.total - project.policy.confirmed,
                  })}
                </p>
              </>
            ) : (
              <p className="text-muted text-sm">{t("policy.empty")}</p>
            )}
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
          {report ? (
            <span className="text-muted text-sm">
              {t("modules.results", {
                number: report.runNumber,
                date: format.dateTime(new Date(report.date), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
              })}
            </span>
          ) : null}
        </div>
        {project.verified || report ? (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-2.5 p-0">
            {(report?.modules ?? []).map((m) => (
              <li
                key={m.key}
                className="border-line bg-panel-2 flex items-center gap-3.5 rounded-[20px] border p-4"
              >
                <span
                  aria-hidden="true"
                  className="bg-progress-bg text-accent font-display inline-flex size-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold"
                >
                  {m.code}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{t(`modules.names.${m.key}`)}</span>
                  <span className={cn("text-[13px]", m.blocked ? "text-warning" : "text-muted")}>
                    {m.blocked ? t("modules.blocked") : t(`modules.notes.${m.key}`)}
                  </span>
                </div>
                <span className="text-muted text-[13px] whitespace-nowrap">
                  {m.findings === null
                    ? t("modules.notRun")
                    : t("modules.findings", { count: m.findings })}
                </span>
                {m.blocked ? (
                  <ButtonLink
                    href={`${base}/identities`}
                    variant="ghost"
                    size="sm"
                    className="px-2"
                  >
                    {t("modules.addIdentity")}
                  </ButtonLink>
                ) : project.verified ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      toast.show({
                        type: "info",
                        title: t("modules.runTitle", { name: t(`modules.names.${m.key}`) }),
                      })
                    }
                  >
                    {t("modules.run")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t("modules.emptyTitle")} text={t("modules.emptyText")} />
        )}
      </section>
    </>
  );
}

/** V-16. Dashboard del proyecto: estado, hallazgos, política y módulos de prueba. */
export function DashboardView({ id }: { id: string }) {
  return (
    <ProjectShell id={id} title={(project) => project.name}>
      {(project) => <Dashboard project={project} />}
    </ProjectShell>
  );
}
