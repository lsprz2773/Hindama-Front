"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { ROLE_KEY, useFlag } from "@/features/account/browser-store";
import { ErrorPanel } from "@/features/errors/error-panel";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Loadable } from "@/components/ui/loadable";
import { StatsSkeleton } from "@/components/skeletons/page-skeletons";
import { EmptyState } from "@/components/ui/state-view";
import { inputClass } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { useSimulatedLoad } from "./use-simulated-load";
import { ADMIN_STUB, STATS, STATS_END, type StatsPeriod, type StatsSet } from "./data";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";
const DAY = 86_400_000;
const PERIODS: StatsPeriod[] = ["7", "30", "90", "custom"];
/** Antes de esta fecha la plataforma aún no tenía actividad: el periodo sale vacío. */
const FIRST_DATA = "2026-09-01";

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

function LineChart({ set, label }: { set: StatsSet; label: string }) {
  const t = useTranslations("Stats");
  const max = Math.max(...set.series.map(([, v]) => v));
  const top = Math.ceil(max / 100) * 100 || 100;
  const W = 960;
  const H = 250;
  const x = (i: number) => 70 + (i * (W - 110)) / Math.max(1, set.series.length - 1);
  const y = (v: number) => 210 - (v / top) * 190;
  const guides = Array.from({ length: top / 100 + 1 }, (_, i) => i * 100);
  const summary = set.series.map(([l, v]) => `${l}, ${v}`).join("; ");
  const unit = t(`unit.${set.unit}`);

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
        points={set.series.map(([, v], i) => `${x(i)},${y(v)}`).join(" ")}
      />
      {set.series.map(([l, v], i) => (
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
        x={x(set.series.length - 1)}
        y={y(set.series.at(-1)![1]) - 14}
        textAnchor="middle"
        className="fill-fg text-[14px] font-bold"
      >
        {set.series.at(-1)![1]}
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
  const max = Math.max(...rows.map(([, n]) => n));
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

/** V-33. Estadísticas de uso: solo datos agregados y anónimos, nunca una API ni un analista (RF-78 a RF-80). */
function StatsViewInner() {
  const t = useTranslations("Stats");
  const tm = useTranslations("Dashboard.modules");
  const format = useFormatter();
  const [period, setPeriod] = useState<StatsPeriod>("30");
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState(STATS_END);

  const load = useSimulatedLoad(`${period}|${from}|${to}`);
  const rangeInvalid = period === "custom" && (!from || !to || from > to || to > STATS_END);
  const days = period === "custom" ? 30 : Number(period);
  const start =
    period === "custom" ? parse(from) : new Date(parse(STATS_END).getTime() - (days - 1) * DAY);
  const end = period === "custom" ? parse(to) : parse(STATS_END);
  const empty = period === "custom" && !rangeInvalid && to < FIRST_DATA;
  const set = STATS[period === "custom" ? "30" : period];
  const fmt = (d: Date) => format.dateTime(d, { day: "numeric", month: "short", timeZone: "UTC" });
  const fmtYear = (d: Date) =>
    format.dateTime(d, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <AppShell
      role="admin"
      userName={ADMIN_STUB.name}
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
        {!rangeInvalid ? (
          <span className="text-muted text-sm" role="status">
            {t("range", { from: fmt(start), to: fmtYear(end) })}
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
              value={from}
              max={STATS_END}
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
              value={to}
              max={STATS_END}
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
        <Loadable
          status={load.status}
          skeleton={<StatsSkeleton label={t("loading")} />}
          error={{ subject: t("errorSubject"), reference: "5C2E-18AB", onRetry: load.retry }}
        >
          {empty ? (
            <EmptyState title={t("empty.title")} text={t("empty.text")} />
          ) : (
            <>
              <dl className="stagger m-0 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
                {set.kpis.map((k, i) => (
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
                      {k.key === "resolution" ? (
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
                    {t(`runsBy.${set.unit}`)}
                  </h2>
                  <span className="text-muted text-[13px]">{t("hover")}</span>
                </div>
                <LineChart set={set} label={t(`runsBy.${set.unit}`)} />
              </section>

              <div className="flex flex-wrap items-start gap-5">
                <section aria-labelledby="bm-h" className={cn(card, "min-w-[300px] flex-1")}>
                  <h2 id="bm-h" className="text-lg font-semibold">
                    {t("byModule")}
                  </h2>
                  <Bars
                    rows={set.modules}
                    label={t("byModuleList")}
                    names={(key) => tm(`names.${key as "auth"}`)}
                  />
                </section>
                <section aria-labelledby="bo-h" className={cn(card, "min-w-[300px] flex-1")}>
                  <h2 id="bo-h" className="text-lg font-semibold">
                    {t("byOwasp")}
                  </h2>
                  <Bars
                    rows={set.owasp}
                    label={t("byOwaspList")}
                    names={(key) => t(`owasp.${key as "API1"}`)}
                  />
                </section>
              </div>
            </>
          )}
        </Loadable>
      )}

      <p className="text-muted text-[13.5px] leading-[1.55]">{t("privacy")}</p>
    </AppShell>
  );
}

/** Solo para administradores: un analista con sesión ve el 403 (RNF-05). */
export function StatsView() {
  const role = useFlag(ROLE_KEY);
  return role === "analyst" ? (
    <ErrorPanel code={403} audience="analyst" href="/projects" />
  ) : (
    <StatsViewInner />
  );
}
