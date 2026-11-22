"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { ROLE_KEY, useFlag } from "@/features/account/browser-store";
import { ErrorPanel } from "@/features/errors/error-panel";
import { AppShell } from "@/components/layout/app-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Loadable } from "@/components/ui/loadable";
import { SkeletonRegion, SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/state-view";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  ACTION_TONE,
  ADMIN_STUB,
  AUDIT_ACTIONS,
  AUDIT_RECORDS,
  abbreviateId,
  hostFingerprint,
  type AuditAction,
  type AuditRecord,
} from "./data";
import { useSimulatedLoad } from "./use-simulated-load";

const PAGE_SIZE = 10;
const GRID =
  "grid min-w-[920px] grid-cols-[170px_minmax(0,1.5fr)_minmax(0,1.4fr)_100px_130px_40px] items-center gap-3";
const DOT: Record<(typeof ACTION_TONE)[AuditAction], string> = {
  ok: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  progress: "bg-accent",
};

interface Filters {
  from: string;
  to: string;
  action: AuditAction | "all";
  user: string;
  host: string;
}
const DEFAULTS: Filters = {
  from: "2026-10-23",
  to: "2026-10-30",
  action: "all",
  user: "",
  host: "",
};

/** El servidor resuelve el correo y compara por identificador; aquí se imita (RF-84). */
function matchesUser(record: AuditRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const id = record.user.id.toLowerCase();
  if (id === q || id.includes(q) || abbreviateId(record.user.id).toLowerCase().includes(q))
    return true;
  // Las cuentas eliminadas ya no tienen correo: solo se encuentran por identificador.
  return !record.user.deleted && record.user.email?.toLowerCase() === q;
}

function Field({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-[170px] flex-1 flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

/** V-34. Bitácora de auditoría: solo lectura, sin credenciales ni textos libres (RF-81 a RF-84). */
function AuditLogViewInner() {
  const t = useTranslations("AuditLog");
  const format = useFormatter();
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useSimulatedLoad(JSON.stringify({ ...filters }));
  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  const hostFp = filters.host.trim() ? hostFingerprint(filters.host) : "";
  const visible = rangeInvalid
    ? []
    : AUDIT_RECORDS.filter((r) => {
        const day = r.at.slice(0, 10);
        if (filters.from && day < filters.from) return false;
        if (filters.to && day > filters.to) return false;
        if (filters.action !== "all" && r.action !== filters.action) return false;
        if (!matchesUser(r, filters.user)) return false;
        if (hostFp && r.hostFp !== hostFp) return false;
        return true;
      });
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const first = visible.length === 0 ? 0 : current * PAGE_SIZE + 1;
  const last = current * PAGE_SIZE + rows.length;
  const userNote =
    filters.user.trim() && visible.length === 0
      ? filters.user.includes("@")
        ? t("user.deletedHint")
        : t("user.none")
      : null;

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
    setOpenId(null);
  }

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.show({ type: "success", title: t("copied") });
    } catch {
      toast.show({ type: "error", title: t("copyFailed") });
    }
  }

  const dateTime = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    });

  return (
    <AppShell
      role="admin"
      userName={ADMIN_STUB.name}
      breadcrumb={[{ label: t("crumb") }]}
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        <ButtonLink href="/admin" variant="secondary" size="sm">
          <Icon name="chart" size={16} />
          {t("viewStats")}
        </ButtonLink>
      }
    >
      <form
        onSubmit={(e) => e.preventDefault()}
        aria-label={t("filters.title")}
        className="border-line bg-panel flex flex-wrap items-start gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <Field id="log-from" label={t("filters.from")}>
          <input
            id="log-from"
            type="date"
            value={filters.from}
            onChange={(e) => set("from", e.target.value)}
            aria-invalid={rangeInvalid || undefined}
            aria-describedby={rangeInvalid ? "log-range-error" : undefined}
            className={inputClass}
          />
        </Field>
        <Field id="log-to" label={t("filters.to")}>
          <input
            id="log-to"
            type="date"
            value={filters.to}
            onChange={(e) => set("to", e.target.value)}
            aria-invalid={rangeInvalid || undefined}
            aria-describedby={rangeInvalid ? "log-range-error" : undefined}
            className={inputClass}
          />
        </Field>
        <Field id="log-action" label={t("filters.action")}>
          <select
            id="log-action"
            value={filters.action}
            onChange={(e) => set("action", e.target.value as Filters["action"])}
            className={inputClass}
          >
            <option value="all">{t("filters.allActions")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`actions.${a}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="log-user" label={t("filters.user")}>
          <input
            id="log-user"
            type="search"
            value={filters.user}
            placeholder={t("filters.userPlaceholder")}
            onChange={(e) => set("user", e.target.value)}
            aria-describedby={userNote ? "log-user-note" : undefined}
            className={inputClass}
          />
          {userNote ? (
            <span id="log-user-note" className="text-muted text-[13px]">
              {userNote}
            </span>
          ) : null}
        </Field>
        <Field id="log-host" label={t("filters.host")}>
          <input
            id="log-host"
            type="search"
            value={filters.host}
            placeholder="api.ejemplo.mx"
            onChange={(e) => set("host", e.target.value)}
            aria-describedby="log-host-help"
            className={inputClass}
          />
          <span id="log-host-help" className="text-muted text-[13px]">
            {hostFp
              ? visible.length > 0
                ? t("host.matches", { count: visible.length })
                : t("host.none")
              : t("host.help")}
          </span>
        </Field>
        <Button
          type="button"
          variant="secondary"
          className="mt-[30px]"
          onClick={() => {
            setFilters(DEFAULTS);
            setPage(0);
            setOpenId(null);
          }}
        >
          {t("filters.clear")}
        </Button>
        {rangeInvalid ? (
          <span
            id="log-range-error"
            role="alert"
            className="flex basis-full items-center gap-2 text-sm"
          >
            <Icon name="alertCircle" size={16} className="text-danger" />
            {t("filters.invalidRange")}
          </span>
        ) : null}
      </form>

      <section
        aria-labelledby="tb-h"
        className="border-line bg-panel flex flex-col gap-3 overflow-x-auto rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="tb-h" className="text-lg font-semibold">
            {t("count", { count: visible.length })}
          </h2>
          <span className="text-muted inline-flex items-center gap-2 text-[13px]">
            <Icon name="lock" size={14} />
            {t("readOnly")}
          </span>
        </div>

        <Loadable
          status={load.status}
          skeleton={
            <SkeletonRegion label={t("loading")}>
              <SkeletonRows rows={6} />
            </SkeletonRegion>
          }
          error={{ subject: t("errorSubject"), reference: "9D41-70F3", onRetry: load.retry }}
        >
          {visible.length === 0 ? (
            <EmptyState
              title={rangeInvalid ? t("empty.invalidTitle") : t("empty.title")}
              text={rangeInvalid ? t("empty.invalidText") : t("empty.text")}
            />
          ) : (
            <>
              <div aria-hidden="true" className={cn(GRID, "text-muted px-4 text-[12.5px]")}>
                <span>{t("cols.date")}</span>
                <span>{t("cols.user")}</span>
                <span>{t("cols.action")}</span>
                <span>{t("cols.project")}</span>
                <span>{t("cols.ip")}</span>
                <span />
              </div>
              <ul className="stagger m-0 flex min-w-[920px] list-none flex-col gap-1.5 p-0">
                {rows.map((r) => {
                  const open = openId === r.id;
                  const short = abbreviateId(r.user.id);
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "rounded-[18px] border",
                        open ? "bg-panel-2 border-line-strong" : "border-line bg-panel-2/60",
                      )}
                    >
                      <div className={cn(GRID, "px-4 py-3")}>
                        <code className="font-mono text-[12.5px]">{dateTime(r.at)}</code>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            title={t("filterByUser")}
                            onClick={() => set("user", r.user.id)}
                            className="text-link cursor-pointer font-mono text-[13px] underline"
                          >
                            {short}
                          </button>
                          <button
                            type="button"
                            aria-label={t("copyId", { user: short })}
                            onClick={() => void copy(r.user.id)}
                            className="text-muted hover:bg-track inline-flex size-7 cursor-pointer items-center justify-center rounded-lg"
                          >
                            <Icon name="copy" size={14} />
                          </button>
                          {r.user.deleted ? (
                            <span className="bg-track rounded-full px-2.5 py-0.5 text-[11.5px] font-bold">
                              {t("deletedAccount")}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <span
                            aria-hidden="true"
                            className={cn("size-2 rounded-full", DOT[ACTION_TONE[r.action]])}
                          />
                          {t(`actions.${r.action}`)}
                        </span>
                        <code className="font-mono text-[12.5px]">{r.project ?? "—"}</code>
                        <code className="font-mono text-[12.5px]">{r.ip}</code>
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={t("detailOf", { date: dateTime(r.at) })}
                          onClick={() => setOpenId(open ? null : r.id)}
                          className="text-muted hover:bg-track inline-flex size-9 cursor-pointer items-center justify-center rounded-xl"
                        >
                          <Icon name={open ? "chevronUp" : "chevronDown"} size={18} />
                        </button>
                      </div>
                      {open ? (
                        <dl className="border-line m-0 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-3 border-t px-4 py-4">
                          {r.detail.map((d) => (
                            <div key={d.label} className="flex flex-col gap-0.5">
                              <dt className="text-muted text-[12.5px]">{t(`detail.${d.label}`)}</dt>
                              <dd className="m-0 text-sm">
                                {"raw" in d.value
                                  ? d.label === "permanentDelete"
                                    ? t("values.byDate", {
                                        date: format.dateTime(
                                          new Date(`${d.value.raw}T00:00:00Z`),
                                          {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                            timeZone: "UTC",
                                          },
                                        ),
                                      })
                                    : d.value.raw
                                  : d.value.msg === "fingerprint"
                                    ? t("values.fingerprint", {
                                        fp: `${(r.hostFp ?? "").slice(0, 4)}…${(r.hostFp ?? "").slice(4)}`,
                                      })
                                    : t(`values.${d.value.msg}`)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <nav
                aria-label={t("pagination.label")}
                className="flex flex-wrap items-center justify-between gap-3 pt-2"
              >
                <span className="text-muted text-sm" role="status">
                  {t("pagination.range", { from: first, to: last, total: visible.length })}
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={current === 0}
                    onClick={() => setPage(current - 1)}
                  >
                    {t("pagination.previous")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={current >= pages - 1}
                    onClick={() => setPage(current + 1)}
                  >
                    {t("pagination.next")}
                  </Button>
                </span>
              </nav>
            </>
          )}
        </Loadable>
      </section>
    </AppShell>
  );
}

/** Solo para administradores: un analista con sesión ve el 403 (RNF-05). */
export function AuditLogView() {
  const role = useFlag(ROLE_KEY);
  return role === "analyst" ? (
    <ErrorPanel code={403} audience="analyst" href="/projects" />
  ) : (
    <AuditLogViewInner />
  );
}
