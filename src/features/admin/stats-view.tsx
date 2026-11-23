"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useMe } from "@/features/account/api";
import { useIsClient } from "@/features/account/browser-store";
import { MODULE_VIEW } from "@/features/runs/modules";
import { ErrorPanel } from "@/features/errors/error-panel";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { QueryState } from "@/components/ui/query-state";
import { StatsSkeleton } from "@/components/skeletons/page-skeletons";
import { EmptyState } from "@/components/ui/state-view";
import { inputClass } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import type { AdminStats } from "@/lib/api/schemas/admin";
import { useAdminStats } from "./api";
import {
  groupFor,
  isValidRange,
  niceStep,
  owaspKey,
  presetRange,
  utcDay,
  type StatsGroup,
  type StatsPeriod,
} from "./stats";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";
const PERIODS: StatsPeriod[] = ["7", "30", "90", "custom"];

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

type Series = [label: string, value: number][];

function LineChart({
  series,
  unit: unitKey,
  label,
}: {
  series: Series;
  unit: "runs" | "findings";
  label: string;
}) {
  const t = useTranslations("Stats");
  const max = Math.max(0, ...series.map(([, v]) => v));
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const W = 960;
  const H = 250;
  const x = (i: number) => 70 + (i * (W - 110)) / Math.max(1, series.length - 1);
  const y = (v: number) => 210 - (v / top) * 190;
  const guides = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const summary = series.map(([l, v]) => `${l}, ${v}`).join("; ");
  const unit = t(`unit.${unitKey}`);

  return (
    <svg
      role="img"
      aria-label={t("chart.summary", { label, items: summary })}
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
    >
      {guides.map((g) => (
        <g key={g}>
          <line
            x1={60}
            x2={W - 20}
            y1={y(g)}
            y2={y(g)}
            className="stroke-line-strong"
            strokeDasharray={g === 0 ? undefined : "3 5"}
          />
          <text x={50} y={y(g) + 4} textAnchor="end" className="fill-muted text-[12px]">
            {g}
          </text>
        </g>
      ))}
      <polyline
        fill="none"
        className="stroke-accent animate-draw"
        pathLength={1}
        strokeDasharray={1}
        strokeWidth={3}
        strokeLinejoin="round"
        points={series.map(([, v], i) => `${x(i)},${y(v)}`).join(" ")}
      />
      {series.map(([l, v], i) => (
        <g key={l}>
          <circle
            cx={x(i)}
            cy={y(v)}
            r={6}
            className="fill-accent stroke-line animate-fade-in"
            style={{ animationDelay: `${500 + i * 80}ms` }}
            strokeWidth={2}
          >
            <title>{t("chart.tip", { label: l, value: v, unit })}</title>
          </circle>
          <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted text-[12.5px]">
            {l}
          </text>
        </g>
      ))}
      <text
        x={x(series.length - 1)}
        y={y(series.at(-1)![1]) - 14}
        textAnchor="middle"
        className="fill-fg text-[14px] font-bold"
      >
        {series.at(-1)![1]}
      </text>
    </svg>
  );
}

function Bars({
  rows,
  label,
  names,
}: {
  rows: [string, number][];
  label: string;
  names: (key: string) => string;
}) {
  const t = useTranslations("Stats");
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <ul role="list" aria-label={label} className="m-0 flex list-none flex-col gap-2.5 p-0">
      {rows.map(([key, n]) => (
        <li
          key={key}
          title={t("bars.tip", { name: names(key), count: n })}
          className="grid grid-cols-[minmax(110px,170px)_minmax(0,1fr)_56px] items-center gap-3 text-sm"
        >
          <span>{names(key)}</span>
          <span aria-hidden="true" className="bg-track block h-2.5 overflow-hidden rounded">
            <span
              className="bg-accent animate-grow-x block h-full origin-left rounded"
              style={{ width: `${(n / max) * 100}%` }}
            />
          </span>
          <b className="text-right tabular-nums">{n.toLocaleString("en-US")}</b>
        </li>
      ))}
    </ul>
  );
}

/** Indicadores de la vista a partir de `AdminStats` (RF-78). */
function kpisOf(stats: AdminStats, number: (n: number) => string) {
  const days = stats.findings.average_days_to_resolve;
  return [
    { key: "users", value: number(stats.users.total), note: { count: stats.users.new } },
    { key: "projects", value: number(stats.projects.created), note: {} },
    {
      key: "runs",
      value: number(stats.runs.started),
      note: { cancelled: stats.runs.cancelled, failed: stats.runs.failed },
    },
    { key: "resolution", value: days === null ? "—" : number(days), note: {} },
    { key: "deletedAccounts", value: number(stats.users.deleted), note: {} },
    { key: "regressions", value: number(stats.findings.regressions), note: {} },
  ] as const;
}

/** Sin nada que contar en el periodo (ni cuentas, ni proyectos, ni ejecuciones, ni hallazgos). */
const isEmpty = (stats: AdminStats) =>
  stats.users.new === 0 &&
  stats.users.deleted === 0 &&
  stats.projects.created === 0 &&
  stats.runs.started === 0 &&
  stats.findings.detected === 0;

/** V-33. Estadísticas de uso: solo datos agregados y anónimos, nunca una API ni un analista (RF-78 a RF-80). */
function StatsViewInner() {
  const t = useTranslations("Stats");
  const tm = useTranslations("Dashboard.modules");
  const format = useFormatter();
  const client = useIsClient();
  // «Hoy» solo se conoce en el navegador; antes de montar no se consulta nada.
  const today = client ? utcDay(new Date()) : null;
  const [period, setPeriod] = useState<StatsPeriod>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const customFrom = from || (today ? presetRange(today, 30).dateFrom : "");
  const customTo = to || today || "";
  const rangeInvalid =
    period === "custom" && today !== null && !isValidRange(customFrom, customTo, today);
  const range = ((): { dateFrom: string; dateTo: string; group: StatsGroup } | null => {
    if (!today || rangeInvalid) return null;
    if (period === "custom")
      return { dateFrom: customFrom, dateTo: customTo, group: groupFor(customFrom, customTo) };
    return presetRange(today, Number(period) as 7 | 30 | 90);
  })();

  const query = useAdminStats({
    dateFrom: range?.dateFrom,
    dateTo: range?.dateTo,
    group: range?.group ?? "day",
    enabled: range !== null,
  });

  const fmt = (iso: string) =>
    format.dateTime(parse(iso), { day: "numeric", month: "short", timeZone: "UTC" });
  const fmtYear = (iso: string) =>
    format.dateTime(parse(iso), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  const number = (n: number) => format.number(n, { maximumFractionDigits: 1 });

  return (
    <AppShell
      role="admin"
      breadcrumb={[{ label: t("crumb") }]}
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        <ButtonLink href="/admin/audit-log" variant="secondary" size="sm">
          <Icon name="list" size={16} />
          {t("viewLog")}
        </ButtonLink>
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <div
          role="radiogroup"
          aria-label={t("period.label")}
          className="border-line bg-panel-2 inline-flex flex-wrap gap-1 rounded-2xl border p-1"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={cn(
                "min-h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold transition-colors duration-200",
                period === p ? "bg-accent text-on-accent" : "text-fg",
              )}
            >
              {p === "custom" ? t("period.custom") : t("period.days", { count: Number(p) })}
            </button>
          ))}
        </div>
        {range ? (
          <span className="text-muted text-sm" role="status">
            {t("range", { from: fmt(range.dateFrom), to: fmtYear(range.dateTo) })}
          </span>
        ) : null}
      </div>

      {period === "custom" ? (
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-[170px] flex-col gap-2">
            <label htmlFor="stats-from" className="text-sm font-semibold">
              {t("custom.from")}
            </label>
            <input
              id="stats-from"
              type="date"
              value={customFrom}
              max={today ?? undefined}
              onChange={(e) => setFrom(e.target.value)}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? "stats-range-error" : undefined}
              className={inputClass}
            />
          </div>
          <div className="flex min-w-[170px] flex-col gap-2">
            <label htmlFor="stats-to" className="text-sm font-semibold">
              {t("custom.to")}
            </label>
            <input
              id="stats-to"
              type="date"
              value={customTo}
              max={today ?? undefined}
              onChange={(e) => setTo(e.target.value)}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? "stats-range-error" : undefined}
              className={inputClass}
            />
          </div>
          {rangeInvalid ? (
            <span
              id="stats-range-error"
              role="alert"
              className="flex items-center gap-2 pb-3.5 text-sm"
            >
              <Icon name="alertCircle" size={16} className="text-danger" />
              {t("custom.invalid")}
            </span>
          ) : null}
        </div>
      ) : null}

      {rangeInvalid ? null : (
        <QueryState
          query={query}
          subject={t("errorSubject")}
          skeleton={<StatsSkeleton label={t("loading")} />}
        >
          {(stats) => {
            if (isEmpty(stats))
              return <EmptyState title={t("empty.title")} text={t("empty.text")} />;
            const activity: Series = stats.activity.map((a) => [fmt(a.start), a.runs_started]);
            const weekly: Series = stats.findings.weekly.map((w) => [fmt(w.week), w.detected]);
            const moduleName = (key: string) =>
              tm(`names.${MODULE_VIEW[key as keyof typeof MODULE_VIEW].key}`);
            return (
              <>
                <dl className="stagger m-0 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
                  {kpisOf(stats, number).map((k, i) => (
                    <div
                      key={k.key}
                      className={cn(
                        "border-line flex flex-col gap-1.5 rounded-[24px] border p-5",
                        i === 0 ? "bg-[image:var(--hero)]" : "bg-panel",
                      )}
                    >
                      <dt className="text-muted order-2 text-sm">{t(`kpi.${k.key}.label`)}</dt>
                      <dd className="font-display order-1 m-0 text-[34px] leading-none font-medium tabular-nums">
                        {k.value}
                        {k.key === "resolution" && k.value !== "—" ? (
                          <span className="text-xl"> {t("days")}</span>
                        ) : null}
                      </dd>
                      <span className="text-muted order-3 text-[13px]">
                        {t(`kpi.${k.key}.note`, k.note)}
                      </span>
                    </div>
                  ))}
                </dl>

                <section aria-labelledby="ln-h" className={card}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 id="ln-h" className="text-lg font-semibold">
                      {t(`runsBy.${stats.period.group}`)}
                    </h2>
                    <span className="text-muted text-[13px]">{t("hover")}</span>
                  </div>
                  <LineChart
                    series={activity}
                    unit="runs"
                    label={t(`runsBy.${stats.period.group}`)}
                  />
                </section>

                <section aria-labelledby="wk-h" className={card}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 id="wk-h" className="text-lg font-semibold">
                      {t("findingsByWeek")}
                    </h2>
                    <span className="text-muted text-[13px]">{t("weekStart")}</span>
                  </div>
                  <LineChart series={weekly} unit="findings" label={t("findingsByWeek")} />
                </section>

                <div className="flex flex-wrap items-start gap-5">
                  <section aria-labelledby="bm-h" className={cn(card, "min-w-[300px] flex-1")}>
                    <h2 id="bm-h" className="text-lg font-semibold">
                      {t("byModule")}
                    </h2>
                    {stats.findings.by_module.length > 0 ? (
                      <Bars
                        rows={stats.findings.by_module.map((m) => [m.module, m.detected])}
                        label={t("byModuleList")}
                        names={moduleName}
                      />
                    ) : (
                      <p className="text-muted text-sm">{t("noFindings")}</p>
                    )}
                  </section>
                  <section aria-labelledby="bo-h" className={cn(card, "min-w-[300px] flex-1")}>
                    <h2 id="bo-h" className="text-lg font-semibold">
                      {t("byOwasp")}
                    </h2>
                    {stats.findings.by_owasp_category.length > 0 ? (
                      <Bars
                        rows={stats.findings.by_owasp_category.map((c) => [
                          c.owasp_category,
                          c.detected,
                        ])}
                        label={t("byOwaspList")}
                        names={(key) =>
                          t.has(`owasp.${owaspKey(key)}` as "owasp.API1")
                            ? t(`owasp.${owaspKey(key) as "API1"}`)
                            : key
                        }
                      />
                    ) : (
                      <p className="text-muted text-sm">{t("noFindings")}</p>
                    )}
                  </section>
                </div>
              </>
            );
          }}
        </QueryState>
      )}

      <p className="text-muted text-[13.5px] leading-[1.55]">{t("privacy")}</p>
    </AppShell>
  );
}

/** Solo para administradores: un analista con sesión ve el 403 (RNF-05). */
export function StatsView() {
  // Solo decide qué pantalla mostrar; los permisos los aplica la API.
  const role = useMe().data?.role;
  return role === "analyst" ? (
    <ErrorPanel code={403} audience="analyst" href="/projects" />
  ) : (
    <StatsViewInner />
  );
}
