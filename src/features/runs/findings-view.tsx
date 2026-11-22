"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { TablePageSkeleton } from "@/components/skeletons/page-skeletons";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MethodBadge } from "@/components/ui/method-badge";
import { QueryState } from "@/components/ui/query-state";
import { SEVERITIES, SeverityMeter } from "@/components/ui/severity";
import { EmptyState, NoResultsState } from "@/components/ui/state-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { inputClass } from "@/components/ui/text-field";
import { useProject } from "@/features/projects/api";
import { ProjectShell } from "@/features/projects/project-shell";
import { Link } from "@/i18n/navigation";
import { OPEN_STATUSES, type FindingStatus, type Severity } from "@/lib/api/schemas/findings";
import type { Project } from "@/lib/api/schemas/projects";
import type { Schemas } from "@/lib/api/types";
import { isUuid } from "@/lib/api/zod";
import { useFindings, useRun } from "./api";
import { badgeStatus, FINDING_STATUSES } from "./finding-status";
import { MODULE_ORDER, MODULE_VIEW } from "./modules";

type Module = Schemas["Module"];

/** RF-65: 20 por página (`listFindings`). */
const PAGE_SIZE = 20;

interface Filters {
  module: Module | "all";
  severity: Severity | "all";
  status: FindingStatus | "open" | "all";
  /** `run_id`: llega de V-27 (`?run=`) con los hallazgos detectados en esa ejecución. */
  run: string | null;
}

const CLEARED: Filters = { module: "all", severity: "all", status: "all", run: null };

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[170px] flex-1 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Número de la ejecución del filtro, para su etiqueta. */
function RunChipLabel({ projectId, runId }: { projectId: string; runId: string }) {
  const t = useTranslations("Findings");
  const run = useRun(projectId, runId).data;
  return <>{run ? t("chips.run", { number: run.number }) : t("chips.runLoading")}</>;
}

function FindingsList({ project }: { project: Project }) {
  const t = useTranslations("Findings");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  const tst = useTranslations("Status");
  const base = `/projects/${project.id}`;
  const runParam = useSearchParams().get("run");
  const [filters, setFilters] = useState<Filters>(() => ({
    ...CLEARED,
    status: "open",
    run: runParam && isUuid(runParam) ? runParam : null,
  }));
  const [page, setPage] = useState(1);
  const query = useFindings(project.id, {
    page,
    pageSize: PAGE_SIZE,
    module: filters.module === "all" ? undefined : [filters.module],
    severity: filters.severity === "all" ? undefined : [filters.severity],
    status:
      filters.status === "all"
        ? undefined
        : filters.status === "open"
          ? [...OPEN_STATUSES]
          : [filters.status],
    runId: filters.run ?? undefined,
  });
  const active =
    filters.module !== "all" ||
    filters.severity !== "all" ||
    filters.status !== "all" ||
    filters.run !== null;

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }
  function clear() {
    setFilters(CLEARED);
    setPage(1);
  }

  // Sin ninguna ejecución no puede haber hallazgos.
  if (!project.last_run)
    return (
      <EmptyState
        title={t("empty.title")}
        text={t("empty.text")}
        action={{ label: t("empty.action"), href: `${base}/runs/new` }}
      />
    );

  const chips: { key: string; label: React.ReactNode; text: string; clear: () => void }[] = [];
  if (filters.run)
    chips.push({
      key: "run",
      label: <RunChipLabel projectId={project.id} runId={filters.run} />,
      text: t("chips.runText"),
      clear: () => set("run", null),
    });
  if (filters.status !== "all") {
    const label = t("chips.status", {
      value: (filters.status === "open"
        ? t("status.open")
        : tst(`finding.${badgeStatus(filters.status)}`)
      ).toLowerCase(),
    });
    chips.push({ key: "status", label, text: label, clear: () => set("status", "all") });
  }
  if (filters.module !== "all") {
    const label = t("chips.module", { value: tm(`names.${MODULE_VIEW[filters.module].key}`) });
    chips.push({ key: "module", label, text: label, clear: () => set("module", "all") });
  }
  if (filters.severity !== "all") {
    const label = t("chips.severity", { value: ts(filters.severity) });
    chips.push({ key: "severity", label, text: label, clear: () => set("severity", "all") });
  }

  return (
    <>
      <section
        aria-labelledby="fl-h"
        className="border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <h2 id="fl-h" className="text-lg font-semibold">
          {t("filters.title")}
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <Field id="f-mod" label={t("filters.module")}>
            <select
              id="f-mod"
              value={filters.module}
              onChange={(e) => set("module", e.target.value as Filters["module"])}
              className={inputClass}
            >
              <option value="all">{t("filters.allModules")}</option>
              {MODULE_ORDER.map((m) => (
                <option key={m} value={m}>
                  {tm(`names.${MODULE_VIEW[m].key}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-sev" label={t("filters.severity")}>
            <select
              id="f-sev"
              value={filters.severity}
              onChange={(e) => set("severity", e.target.value as Filters["severity"])}
              className={inputClass}
            >
              <option value="all">{t("filters.allSeverities")}</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {ts(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-est" label={t("filters.status")}>
            <select
              id="f-est"
              value={filters.status}
              onChange={(e) => set("status", e.target.value as Filters["status"])}
              className={inputClass}
            >
              <option value="all">{t("filters.all")}</option>
              <option value="open">{t("status.open")}</option>
              {FINDING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tst(`finding.${badgeStatus(s)}`)}
                </option>
              ))}
            </select>
          </Field>
          <Button variant="secondary" onClick={clear} disabled={!active}>
            {t("filters.clear")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted text-sm" role="status">
            {query.data
              ? t("showing", { shown: query.data.items.length, total: query.data.total })
              : null}
          </span>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="bg-panel-2 border-line inline-flex items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-3 text-[13px] font-semibold"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.clear}
                aria-label={t("chips.remove", { filter: chip.text })}
                className="hover:bg-track inline-flex size-6 cursor-pointer items-center justify-center rounded-full"
              >
                <Icon name="x" size={14} />
              </button>
            </span>
          ))}
        </div>
      </section>

      <QueryState query={query} subject={t("subject")} skeleton={<TablePageSkeleton rows={5} />}>
        {(data) => {
          const pages = Math.max(1, Math.ceil(data.total / data.page_size));
          return (
            <section
              aria-labelledby="ls-h"
              className="border-line bg-panel flex flex-col gap-3 rounded-[28px] border p-6 backdrop-blur-lg"
            >
              <h2 id="ls-h" className="text-lg font-semibold">
                {filters.status === "open"
                  ? t("openCount", { count: data.total })
                  : t("count", { count: data.total })}
              </h2>
              {data.items.length === 0 ? (
                active ? (
                  <NoResultsState onClear={clear} />
                ) : (
                  <p className="text-muted text-sm">{t("none")}</p>
                )
              ) : (
                <>
                  <div
                    aria-hidden="true"
                    className="text-muted hidden grid-cols-[176px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_150px_32px] gap-4 px-4 text-[12.5px] font-bold lg:grid"
                  >
                    <span>{t("cols.severity")}</span>
                    <span>{t("cols.finding")}</span>
                    <span>{t("cols.module")}</span>
                    <span>{t("cols.identity")}</span>
                    <span>{t("cols.classification")}</span>
                    <span>{t("cols.status")}</span>
                    <span />
                  </div>
                  <ul className="stagger m-0 flex list-none flex-col gap-2 p-0">
                    {data.items.map((f) => (
                      <li
                        key={f.id}
                        className="bg-panel-2 border-line grid grid-cols-1 items-center gap-x-4 gap-y-2 rounded-[20px] border px-4 py-3.5 lg:grid-cols-[176px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_150px_32px]"
                      >
                        <span className="flex items-center gap-2.5">
                          <SeverityMeter severity={f.severity} />
                          <b className="text-[13px]">{ts(f.severity)}</b>
                        </span>
                        <span className="flex min-w-0 flex-col gap-1.5">
                          <Link
                            href={`${base}/findings/${f.id}`}
                            className="text-fg text-[15px] font-semibold"
                          >
                            {f.title}
                          </Link>
                          <span className="flex flex-wrap items-center gap-2">
                            {f.operation ? (
                              <MethodBadge
                                method={f.operation.method}
                                className="min-w-14 py-[3px] text-[12px]"
                              />
                            ) : null}
                            <code className="text-muted font-mono text-[12.5px] break-all">
                              {f.operation ? f.operation.path : t("globalOperation")}
                            </code>
                          </span>
                        </span>
                        <span className="text-sm">{tm(`names.${MODULE_VIEW[f.module].key}`)}</span>
                        <span className="text-sm">
                          {f.identity.deleted
                            ? t("identityDeleted", { name: f.identity.name })
                            : f.identity.name}
                        </span>
                        <span className="flex flex-wrap gap-1.5 text-[12.5px]">
                          <span className="bg-track rounded-md px-2 py-0.5 font-mono">
                            {f.owasp_category}
                          </span>
                          {f.cwe ? (
                            <span className="bg-track rounded-md px-2 py-0.5 font-mono">
                              {f.cwe}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex">
                          <StatusBadge kind="finding" status={badgeStatus(f.status)} />
                        </span>
                        <Link
                          href={`${base}/findings/${f.id}`}
                          aria-label={t("open", { title: f.title })}
                          className="text-muted hidden size-8 items-center justify-center lg:inline-flex"
                        >
                          <Icon name="chevronRight" size={18} />
                        </Link>
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
          );
        }}
      </QueryState>
    </>
  );
}

/** V-29. Hallazgos del proyecto con filtros (RF-64, RF-65). TODO(api): exportar (RF-77) no está en el contrato. */
export function FindingsView({ id }: { id: string }) {
  const t = useTranslations("Findings");
  const lastRun = useProject(id).data?.last_run;
  return (
    <ProjectShell
      id={id}
      section={t("title")}
      title={t("title")}
      subtitle={lastRun ? t("subtitle", { number: lastRun.number }) : t("subtitleNone")}
      render={(project) => (
        <Suspense>
          <FindingsList key={project.id} project={project} />
        </Suspense>
      )}
    />
  );
}
