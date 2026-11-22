"use client";

import { useTranslations } from "next-intl";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MethodBadge } from "@/components/ui/method-badge";
import { SEVERITIES, SeverityMeter, type Severity } from "@/components/ui/severity";
import { EmptyState, NoResultsState } from "@/components/ui/state-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { ProjectShell } from "@/features/projects/project-shell";
import { Link } from "@/i18n/navigation";
import { FINDING_STATUS_ORDER, type Finding, type FindingStatus, type ModuleKey } from "./data";
import { isOpen, useFindings } from "./findings-store";

const MODULE_KEYS: ModuleKey[] = [
  "auth",
  "config",
  "objects",
  "functions",
  "properties",
  "resources",
  "sql",
];

interface Filters {
  module: ModuleKey | "all";
  severity: Severity | "all";
  status: FindingStatus | "open" | "all";
  reason: "accepted" | "false_positive" | "all";
}

const DEFAULTS: Filters = { module: "all", severity: "all", status: "open", reason: "all" };
const CLEARED: Filters = { ...DEFAULTS, status: "all" };

function matches(f: Finding, filters: Filters): boolean {
  if (filters.module !== "all" && f.module !== filters.module) return false;
  if (filters.severity !== "all" && f.severity !== filters.severity) return false;
  if (
    filters.status === "open" ? !isOpen(f) : filters.status !== "all" && f.status !== filters.status
  )
    return false;
  if (filters.reason !== "all" && !(f.status === "acceptedRisk" && f.reason === filters.reason))
    return false;
  return true;
}

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

function FindingsList({
  id,
  findings,
  visible,
  filters,
  setFilters,
}: {
  id: string;
  findings: Finding[];
  visible: Finding[];
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
}) {
  const t = useTranslations("Findings");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  const tst = useTranslations("Status");
  const base = `/projects/${id}`;
  const active =
    filters.module !== "all" ||
    filters.severity !== "all" ||
    filters.status !== "all" ||
    filters.reason !== "all";

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      // Elegir un motivo de descarte solo tiene sentido entre los descartados.
      if (key === "reason" && value !== "all" && next.status === "open")
        next.status = "acceptedRisk";
      return next;
    });
  }

  if (findings.length === 0)
    return (
      <EmptyState
        title={t("empty.title")}
        text={t("empty.text")}
        action={{ label: t("empty.action"), href: `${base}/runs/new` }}
      />
    );

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.status !== "all")
    chips.push({
      key: "status",
      label: t("chips.status", {
        value: (filters.status === "open"
          ? t("status.open")
          : tst(`finding.${filters.status}`)
        ).toLowerCase(),
      }),
      clear: () => set("status", "all"),
    });
  if (filters.module !== "all")
    chips.push({
      key: "module",
      label: t("chips.module", { value: tm(`names.${filters.module}`) }),
      clear: () => set("module", "all"),
    });
  if (filters.severity !== "all")
    chips.push({
      key: "severity",
      label: t("chips.severity", { value: ts(filters.severity) }),
      clear: () => set("severity", "all"),
    });
  if (filters.reason !== "all")
    chips.push({
      key: "reason",
      label: t("chips.reason", { value: t(`reason.${filters.reason}`) }),
      clear: () => set("reason", "all"),
    });

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
              {MODULE_KEYS.map((m) => (
                <option key={m} value={m}>
                  {tm(`names.${m}`)}
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
              {FINDING_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {tst(`finding.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-mot" label={t("filters.reason")}>
            <select
              id="f-mot"
              value={filters.reason}
              onChange={(e) => set("reason", e.target.value as Filters["reason"])}
              className={inputClass}
            >
              <option value="all">{t("reason.all")}</option>
              <option value="accepted">{t("reason.accepted")}</option>
              <option value="false_positive">{t("reason.false_positive")}</option>
            </select>
          </Field>
          <Button variant="secondary" onClick={() => setFilters(CLEARED)} disabled={!active}>
            {t("filters.clear")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted text-sm" role="status">
            {t("showing", { shown: visible.length, total: findings.length })}
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
                aria-label={t("chips.remove", { filter: chip.label })}
                className="hover:bg-track inline-flex size-6 cursor-pointer items-center justify-center rounded-full"
              >
                <Icon name="x" size={14} />
              </button>
            </span>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="ls-h"
        className="border-line bg-panel flex flex-col gap-3 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <h2 id="ls-h" className="text-lg font-semibold">
          {filters.status === "open"
            ? t("openCount", { count: visible.length })
            : t("count", { count: visible.length })}
        </h2>
        {visible.length === 0 ? (
          <NoResultsState onClear={() => setFilters(CLEARED)} />
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
              {visible.map((f) => (
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
                      {f.method ? (
                        <MethodBadge method={f.method} className="min-w-14 py-[3px] text-[12px]" />
                      ) : null}
                      <code className="text-muted font-mono text-[12.5px] break-all">
                        {f.method ? f.path : t("globalOperation")}
                      </code>
                    </span>
                  </span>
                  <span className="text-sm">{tm(`names.${f.module}`)}</span>
                  <span className="text-sm">{f.identity}</span>
                  <span className="flex flex-wrap gap-1.5 text-[12.5px]">
                    <span className="bg-track rounded-md px-2 py-0.5 font-mono">{f.owasp}</span>
                    <span className="bg-track rounded-md px-2 py-0.5 font-mono">{f.cwe}</span>
                  </span>
                  <span className="flex">
                    <StatusBadge kind="finding" status={f.status} />
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
          </>
        )}
      </section>
    </>
  );
}

/** V-29. Hallazgos del proyecto con filtros y exportación (RF-64, RF-65, RF-77). */
export function FindingsView({ id }: { id: string }) {
  const t = useTranslations("Findings");
  const toast = useToast();
  const { findings } = useFindings(id);
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const visible = [...findings]
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))
    .filter((f) => matches(f, filters));

  return (
    <ProjectShell
      id={id}
      section={t("title")}
      title={t("title")}
      subtitle={(project) =>
        project.report ? t("subtitle", { number: project.report.runNumber }) : t("subtitleNone")
      }
      actions={
        <Button
          variant="secondary"
          size="sm"
          disabled={findings.length === 0}
          onClick={() =>
            toast.show({
              type: "success",
              title: t("exported"),
              text: t("exportedText", { count: visible.length }),
            })
          }
        >
          <Icon name="download" size={16} />
          {t("export")}
        </Button>
      }
    >
      {() => (
        <FindingsList
          id={id}
          findings={findings}
          visible={visible}
          filters={filters}
          setFilters={setFilters}
        />
      )}
    </ProjectShell>
  );
}
