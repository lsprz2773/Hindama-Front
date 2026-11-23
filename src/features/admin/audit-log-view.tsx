"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { useMe } from "@/features/account/api";
import { ErrorPanel } from "@/features/errors/error-panel";
import { AppShell } from "@/components/layout/app-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { QueryState } from "@/components/ui/query-state";
import { SkeletonRegion, SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/state-view";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { AUDIT_ACTIONS, type AuditAction, type AuditLogEntry } from "@/lib/api/schemas/admin";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { useAuditLog } from "./api";
import { ACTION_TONE, abbreviateId, isUserId, startOfDay } from "./audit";

const PAGE_SIZE = 20;
/** Los textos de los filtros no consultan en cada tecla: cada petición cuenta para el límite (RNF-09). */
const TYPING_DELAY_MS = 400;
const GRID =
  "grid min-w-[920px] grid-cols-[170px_minmax(0,1.5fr)_minmax(0,1.4fr)_120px_130px_40px] items-center gap-3";
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
const DEFAULTS: Filters = { from: "", to: "", action: "all", user: "", host: "" };

function useDebounced<T>(value: T, delay = TYPING_DELAY_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Field({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: ReactNode;
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

type Translate = ReturnType<typeof useTranslations<"AuditLog">>;

/** Un identificador opaco: corto en pantalla y completo en el título. */
function Opaque({ id }: { id: string }) {
  return (
    <code title={id} className="font-mono text-[12.5px]">
      {abbreviateId(id)}
    </code>
  );
}

/**
 * Datos propios de cada acción (`AuditDetails`). Se muestran los que se conocen y se ignoran los
 * demás; todo se pinta como texto, nunca como HTML (RF-83: no hay credenciales ni texto libre).
 */
function detailRows(
  entry: AuditLogEntry,
  t: Translate,
): { key: string; label: string; value: ReactNode }[] {
  const d = entry.details;
  const rows: { key: string; label: string; value: ReactNode }[] = [];
  if (d.modules)
    rows.push({
      key: "modules",
      label: t("detail.modules"),
      value: d.modules.map((m) => t(`modules.${m}`)).join(", "),
    });
  if (d.limits)
    rows.push({
      key: "limits",
      label: t("detail.limits"),
      value: t("values.limits", {
        rps: d.limits.requests_per_second,
        concurrency: d.limits.concurrency,
        requests: d.limits.max_requests,
        minutes: d.limits.max_duration_minutes,
      }),
    });
  if (d.run_id) rows.push({ key: "run", label: t("detail.run"), value: <Opaque id={d.run_id} /> });
  if (d.source_run_id)
    rows.push({
      key: "sourceRun",
      label: t("detail.sourceRun"),
      value: <Opaque id={d.source_run_id} />,
    });
  if (d.verification_method)
    rows.push({
      key: "verificationMethod",
      label: t("detail.verificationMethod"),
      value: t(`values.verificationMethod.${d.verification_method}`),
    });
  if (d.identity_id)
    rows.push({
      key: "identity",
      label: t("detail.identity"),
      value: <Opaque id={d.identity_id} />,
    });
  if (d.finding_id)
    rows.push({ key: "finding", label: t("detail.finding"), value: <Opaque id={d.finding_id} /> });
  if (d.dismissal_reason)
    rows.push({
      key: "dismissalReason",
      label: t("detail.dismissalReason"),
      value: t(`values.dismissalReason.${d.dismissal_reason}`),
    });
  if (d.stage)
    rows.push({ key: "stage", label: t("detail.stage"), value: t(`values.stage.${d.stage}`) });
  if (d.block_reason)
    rows.push({
      key: "blockReason",
      label: t("detail.blockReason"),
      value: t(`values.blockReason.${d.block_reason}`),
    });
  return rows;
}

/** V-34. Bitácora de auditoría: solo lectura, sin credenciales ni textos libres (RF-81 a RF-84). */
function AuditLogViewInner() {
  const t = useTranslations("AuditLog");
  const format = useFormatter();
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  // La API filtra por el `id` interno completo: no resuelve correos ni fragmentos.
  const user = filters.user.trim();
  const userInvalid = user !== "" && !isUserId(user);
  const host = useDebounced(filters.host.trim());
  const blocked = rangeInvalid || userInvalid;

  const query = useAuditLog({
    page,
    pageSize: PAGE_SIZE,
    occurredFrom: startOfDay(filters.from),
    occurredTo: startOfDay(filters.to, 1),
    action: filters.action === "all" ? undefined : filters.action,
    userId: user === "" ? undefined : user.toLowerCase(),
    host: host === "" ? undefined : host,
    enabled: !blocked,
  });
  // Un valor que la API no acepta (por ejemplo, un host inválido) es 422 y va junto al campo.
  const rejected = query.error instanceof ApiError && query.error.status === 422;
  const total = query.data?.total;

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
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

  // Hora local del navegador: los filtros de fecha también se interpretan en esa zona.
  const dateTime = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

  return (
    <AppShell
      role="admin"
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
            aria-invalid={userInvalid || undefined}
            aria-describedby="log-user-note"
            spellCheck={false}
            autoComplete="off"
            className={cn(inputClass, "font-mono text-[14px]")}
          />
          <span id="log-user-note" className="text-muted text-[13px]">
            {userInvalid ? t("user.invalid") : t("user.help")}
          </span>
        </Field>
        <Field id="log-host" label={t("filters.host")}>
          <input
            id="log-host"
            type="search"
            value={filters.host}
            placeholder="api.ejemplo.mx"
            onChange={(e) => set("host", e.target.value)}
            aria-invalid={rejected || undefined}
            aria-describedby="log-host-help"
            maxLength={2048}
            spellCheck={false}
            autoComplete="off"
            className={inputClass}
          />
          <span id="log-host-help" className="text-muted text-[13px]">
            {rejected ? t("host.invalid") : host ? t("host.active") : t("host.help")}
          </span>
        </Field>
        <Button
          type="button"
          variant="secondary"
          className="mt-[30px]"
          onClick={() => {
            setFilters(DEFAULTS);
            setPage(1);
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
            {total === undefined || blocked || rejected ? t("title") : t("count", { count: total })}
          </h2>
          <span className="text-muted inline-flex items-center gap-2 text-[13px]">
            <Icon name="lock" size={14} />
            {t("readOnly")}
          </span>
        </div>

        {blocked || rejected ? (
          <EmptyState
            title={rangeInvalid ? t("empty.invalidTitle") : t("empty.invalidFiltersTitle")}
            text={rangeInvalid ? t("empty.invalidText") : t("empty.invalidFiltersText")}
          />
        ) : (
          <QueryState
            query={query}
            subject={t("errorSubject")}
            skeleton={
              <SkeletonRegion label={t("loading")}>
                <SkeletonRows rows={6} />
              </SkeletonRegion>
            }
          >
            {(data) => {
              const pages = Math.max(1, Math.ceil(data.total / data.page_size));
              const first = data.items.length === 0 ? 0 : (data.page - 1) * data.page_size + 1;
              const last = (data.page - 1) * data.page_size + data.items.length;
              return data.items.length === 0 ? (
                <EmptyState title={t("empty.title")} text={t("empty.text")} />
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
                    {data.items.map((r) => {
                      const open = openId === r.id;
                      const details = open ? detailRows(r, t) : [];
                      return (
                        <li
                          key={r.id}
                          className={cn(
                            "rounded-[18px] border",
                            open ? "bg-panel-2 border-line-strong" : "border-line bg-panel-2/60",
                          )}
                        >
                          <div className={cn(GRID, "px-4 py-3")}>
                            <code className="font-mono text-[12.5px]">
                              {dateTime(r.occurred_at)}
                            </code>
                            <span className="flex flex-wrap items-center gap-1.5">
                              {r.user_id ? (
                                <>
                                  <button
                                    type="button"
                                    title={t("filterByUser")}
                                    onClick={() => set("user", r.user_id ?? "")}
                                    className="text-link cursor-pointer font-mono text-[13px] underline"
                                  >
                                    {abbreviateId(r.user_id)}
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t("copyId", { user: abbreviateId(r.user_id) })}
                                    onClick={() => void copy(r.user_id ?? "")}
                                    className="text-muted hover:bg-track inline-flex size-7 cursor-pointer items-center justify-center rounded-lg"
                                  >
                                    <Icon name="copy" size={14} />
                                  </button>
                                </>
                              ) : (
                                <span className="text-muted text-sm">—</span>
                              )}
                            </span>
                            <span className="flex items-center gap-2 text-sm font-semibold">
                              <span
                                aria-hidden="true"
                                className={cn("size-2 rounded-full", DOT[ACTION_TONE[r.action]])}
                              />
                              {t(`actions.${r.action}`)}
                            </span>
                            {r.project_id ? (
                              <Opaque id={r.project_id} />
                            ) : (
                              <code className="font-mono text-[12.5px]">—</code>
                            )}
                            <code
                              title={r.source_ip === null ? t("ipNone") : undefined}
                              className="font-mono text-[12.5px]"
                            >
                              {r.source_ip ?? "—"}
                            </code>
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={t("detailOf", { date: dateTime(r.occurred_at) })}
                              onClick={() => setOpenId(open ? null : r.id)}
                              className="text-muted hover:bg-track inline-flex size-9 cursor-pointer items-center justify-center rounded-xl"
                            >
                              <Icon name={open ? "chevronUp" : "chevronDown"} size={18} />
                            </button>
                          </div>
                          {open ? (
                            details.length === 0 ? (
                              <p className="border-line text-muted m-0 border-t px-4 py-4 text-sm">
                                {t("detail.none")}
                              </p>
                            ) : (
                              <dl className="border-line m-0 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-3 border-t px-4 py-4">
                                {details.map((d) => (
                                  <div key={d.key} className="flex flex-col gap-0.5">
                                    <dt className="text-muted text-[12.5px]">{d.label}</dt>
                                    <dd className="m-0 text-sm break-words">{d.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            )
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
                      {t("pagination.range", { from: first, to: last, total: data.total })}
                    </span>
                    <span className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={data.page <= 1 || query.isFetching}
                        onClick={() => setPage(data.page - 1)}
                      >
                        {t("pagination.previous")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={data.page >= pages || query.isFetching}
                        onClick={() => setPage(data.page + 1)}
                      >
                        {t("pagination.next")}
                      </Button>
                    </span>
                  </nav>
                </>
              );
            }}
          </QueryState>
        )}
      </section>
    </AppShell>
  );
}

/** Solo para administradores: un analista con sesión ve el 403 (RNF-05). */
export function AuditLogView() {
  // Solo decide qué pantalla mostrar; los permisos los aplica la API.
  const role = useMe().data?.role;
  return role === "analyst" ? (
    <ErrorPanel code={403} audience="analyst" href="/projects" />
  ) : (
    <AuditLogViewInner />
  );
}
