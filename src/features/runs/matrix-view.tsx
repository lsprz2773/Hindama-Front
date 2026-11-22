"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { TablePageSkeleton } from "@/components/skeletons/page-skeletons";
import { Button } from "@/components/ui/button";
import { MethodBadge } from "@/components/ui/method-badge";
import { QueryState } from "@/components/ui/query-state";
import { EmptyState } from "@/components/ui/state-view";
import { inputClass } from "@/components/ui/text-field";
import { ErrorPanel } from "@/features/errors/error-panel";
import { ProjectShell } from "@/features/projects/project-shell";
import type { Project } from "@/lib/api/schemas/projects";
import type { Result, Run } from "@/lib/api/schemas/runs";
import type { Schemas } from "@/lib/api/types";
import { isUuid } from "@/lib/api/zod";
import { cn } from "@/lib/cn";
import { useRun, useRunResults } from "./api";
import { MODULE_VIEW } from "./modules";
import { RunTabs } from "./run-tabs";

type Verdict = Schemas["Verdict"];
type Module = Schemas["Module"];

/** RF-64: hasta 500 celdas por página (`listRunResults`). */
const PAGE_SIZE = 500;

const MARK: Record<Verdict, string> = { pass: "✓", fail: "!", error: "?", skipped: "–" };

/** Estilo de cada veredicto: el color refuerza, el símbolo y el texto siempre están (daltonismo). */
const CELL_STYLE: Record<Verdict, string> = {
  pass: "border-line text-success",
  fail: "border-danger border-2 text-danger",
  error: "border-warning border-2 border-dotted text-warning",
  skipped: "border-line border-dashed bg-transparent text-muted",
};

const VERDICTS: Verdict[] = ["pass", "fail", "error", "skipped"];

/** Códigos de `Result.expected`/`observed` que el contrato nombra como ejemplo. */
const CODES = ["allowed", "denied", "own_data_only", "no_sql_error"] as const;
const isCode = (part: string): part is (typeof CODES)[number] =>
  (CODES as readonly string[]).includes(part);

function Switch({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="border-line bg-panel-2 text-fg inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 text-sm font-semibold"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-block h-[22px] w-10 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-4 rounded-full bg-white transition-[left]",
            checked ? "left-[21px]" : "left-[3px]",
          )}
        />
      </span>
      {children}
    </button>
  );
}

interface Row {
  key: string;
  module: Module;
  operation: Result["operation"];
  cells: Map<string, Result>;
}

/** Filas por módulo y operación (`null` = toda la API) y columnas por identidad, en orden de llegada. */
function toMatrix(items: Result[]) {
  const identities = new Map<string, Result["identity"]>();
  const rows = new Map<string, Row>();
  for (const item of items) {
    identities.set(item.identity.id, item.identity);
    const key = `${item.module}:${item.operation?.id ?? "global"}`;
    const row = rows.get(key) ?? {
      key,
      module: item.module,
      operation: item.operation,
      cells: new Map(),
    };
    row.cells.set(item.identity.id, item);
    rows.set(key, row);
  }
  return { identities: [...identities.values()], rows: [...rows.values()] };
}

function Matrix({ project, run }: { project: Project; run: Run }) {
  const t = useTranslations("Matrix");
  const tm = useTranslations("Dashboard.modules");
  const [onlyFails, setOnlyFails] = useState(false);
  const [module, setModule] = useState<Module | "">("");
  const [page, setPage] = useState(1);
  const query = useRunResults(project.id, run.id, {
    page,
    pageSize: PAGE_SIZE,
    module: module ? [module] : undefined,
    verdict: onlyFails ? ["fail"] : undefined,
  });
  const base = `/projects/${project.id}`;

  /** `expected` y `observed` son códigos cortos (`allowed`, `200 denied`): se traducen si se conocen. */
  const code = (value: string) =>
    value
      .split(" ")
      .map((part) => (isCode(part) ? t(`codes.${part}`) : part))
      .join(" ");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RunTabs
          base={base}
          run={run.id}
          active="matrix"
          findings={run.progress.findings_by_severity.total}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="mx-module" className="sr-only">
            {t("module")}
          </label>
          <select
            id="mx-module"
            value={module}
            onChange={(e) => {
              setModule(e.target.value as Module | "");
              setPage(1);
            }}
            className={cn(inputClass, "min-h-11 w-auto")}
          >
            <option value="">{t("allModules")}</option>
            {run.modules.map((m) => (
              <option key={m} value={m}>
                {tm(`names.${MODULE_VIEW[m].key}`)}
              </option>
            ))}
          </select>
          <Switch
            checked={onlyFails}
            onChange={() => {
              setOnlyFails((v) => !v);
              setPage(1);
            }}
          >
            {t("onlyDiscrepancies")}
          </Switch>
        </div>
      </div>

      <section
        aria-labelledby="ley-h"
        className="border-line bg-panel flex flex-wrap items-center gap-3 rounded-[24px] border px-5 py-4 backdrop-blur-lg"
      >
        <h2 id="ley-h" className="text-muted text-sm font-semibold">
          {t("legend.title")}
        </h2>
        {VERDICTS.map((v) => (
          <span
            key={v}
            className={cn(
              "bg-panel-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]",
              CELL_STYLE[v],
            )}
          >
            <b aria-hidden="true" className="font-mono">
              {MARK[v]}
            </b>
            <span className="text-fg">{t(`legend.${v}`)}</span>
          </span>
        ))}
      </section>

      <QueryState query={query} subject={t("subject")} skeleton={<TablePageSkeleton rows={4} />}>
        {(data) => {
          const { identities, rows } = toMatrix(data.items);
          const fails = data.items.filter((r) => r.verdict === "fail").length;
          const pages = Math.max(1, Math.ceil(data.total / data.page_size));
          return (
            <section
              aria-labelledby="mx-h"
              className="border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
            >
              <h2 id="mx-h" className="text-lg font-semibold">
                {t("summary", {
                  rows: rows.length,
                  identities: identities.length,
                  discrepancies: fails,
                })}
              </h2>
              {rows.length === 0 ? (
                onlyFails ? (
                  <EmptyState positive title={t("none.title")} text={t("none.text")} />
                ) : (
                  <EmptyState title={t("empty.title")} text={t("empty.text")} />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-separate border-spacing-2 text-left">
                    <caption className="sr-only">{t("caption")}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="text-muted px-3 py-2 text-[13px] font-bold">
                          {t("operation")}
                        </th>
                        {identities.map((identity) => (
                          <th
                            key={identity.id}
                            scope="col"
                            className="px-3 py-2 text-sm font-semibold"
                          >
                            {identity.deleted
                              ? t("identityDeleted", { name: identity.name })
                              : identity.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key}>
                          <th
                            scope="row"
                            className="bg-panel-2 rounded-[16px] px-3 py-3 align-top font-normal"
                          >
                            <span className="flex flex-wrap items-center gap-2">
                              {row.operation ? <MethodBadge method={row.operation.method} /> : null}
                              <code className="font-mono text-[13px] break-all">
                                {row.operation ? row.operation.path : t("global")}
                              </code>
                            </span>
                            <span className="text-muted mt-1.5 block text-[12.5px]">
                              {tm(`names.${MODULE_VIEW[row.module].key}`)}
                            </span>
                          </th>
                          {identities.map((identity) => {
                            const cell = row.cells.get(identity.id);
                            if (!cell)
                              return (
                                <td key={identity.id} className="p-0 align-top">
                                  <div
                                    role="group"
                                    aria-label={`${identity.name}: ${t("notEvaluated")}`}
                                    className="border-line text-muted flex min-h-[64px] items-center rounded-[16px] border border-dashed px-3 py-2 text-sm"
                                  >
                                    {t("notEvaluated")}
                                  </div>
                                </td>
                              );
                            const verdict = t(`verdict.${cell.verdict}`);
                            const observed = code(cell.observed);
                            const expected = t("expected", { value: code(cell.expected) });
                            return (
                              <td key={identity.id} className="p-0 align-top">
                                {/* TODO(api): `Result` no enlaza su hallazgo; la celda no abre V-30. */}
                                <div
                                  role="group"
                                  aria-label={`${identity.name}: ${verdict}, ${observed}, ${expected.toLowerCase()}`}
                                  className={cn(
                                    "bg-panel-2 text-fg flex min-h-[64px] flex-col justify-center gap-0.5 rounded-[16px] border px-3 py-2",
                                    CELL_STYLE[cell.verdict],
                                  )}
                                >
                                  <span className="flex items-center gap-2 text-sm font-semibold">
                                    <b aria-hidden="true" className="font-mono text-base">
                                      {MARK[cell.verdict]}
                                    </b>
                                    {verdict}
                                  </span>
                                  <span className="text-fg text-[12.5px] break-words">
                                    {observed}
                                  </span>
                                  <span className="text-muted text-[12.5px] break-words">
                                    {expected}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
            </section>
          );
        }}
      </QueryState>
    </>
  );
}

function RunMatrix({ project, runId }: { project: Project; runId: string }) {
  const tr = useTranslations("RunResults");
  const query = useRun(project.id, runId);
  return (
    <QueryState query={query} subject={tr("subject")} skeleton={<TablePageSkeleton rows={4} />}>
      {(run) => <Matrix project={project} run={run} />}
    </QueryState>
  );
}

/** V-28. Matriz de acceso: cada operación frente a cada identidad, con las discrepancias a la vista (RF-61 a RF-64). */
export function MatrixView({ id, runId }: { id: string; runId: string }) {
  const t = useTranslations("Matrix");
  const tr = useTranslations("RunResults");
  const valid = isUuid(id) && isUuid(runId);
  const run = useRun(id, valid ? runId : null).data;
  return (
    <ProjectShell
      id={id}
      trail={[
        { label: tr("crumbHistory"), href: `/projects/${id}/history` },
        {
          label: run ? tr("title", { number: run.number }) : tr("titleLoading"),
          href: `/projects/${id}/runs/${runId}`,
        },
      ]}
      title={t("title")}
      render={(project) =>
        valid ? (
          <RunMatrix key={runId} project={project} runId={runId} />
        ) : (
          <ErrorPanel code={404} standalone={false} href={`/projects/${id}`} />
        )
      }
    />
  );
}
