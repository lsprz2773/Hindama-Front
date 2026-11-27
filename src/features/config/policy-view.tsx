"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { UnsavedChangesGuard } from "@/components/dialogs/unsaved-changes-guard";
import { TablePageSkeleton } from "@/components/skeletons/page-skeletons";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MethodBadge } from "@/components/ui/method-badge";
import { QueryState } from "@/components/ui/query-state";
import { EmptyState, NoResultsState } from "@/components/ui/state-view";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import type { Operation, OperationPage } from "@/lib/api/schemas/contracts";
import type { Project } from "@/lib/api/schemas/projects";
import { cn } from "@/lib/cn";
import { policyAdapter, type PolicyTemplate } from "@/lib/contract/policies";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { projectKey } from "@/features/projects/api";
import { ProjectShell } from "@/features/projects/project-shell";
import { applyPolicy, operationsKey, updateOperation, useOperations } from "./api";

const TEMPLATES: PolicyTemplate[] = ["public", "authenticated", "owner", "ownerOrAdmin", "admin"];
const NEEDS_OWNER: PolicyTemplate[] = ["owner", "ownerOrAdmin"];
/** `listOperations` admite 500 por página; con eso cabe casi cualquier contrato. */
const PAGE_SIZE = 500;
type Filter = "all" | "proposed" | "confirmed";

type Translate = ReturnType<typeof useTranslations<"Policy">>;

interface RowDraft {
  template: PolicyTemplate | null;
  owner: string;
}

/** Lo que muestra una fila sin cambios: la plantilla confirmada o, si no hay, la propuesta. */
function initialOf(op: Operation): RowDraft {
  const policy = op.policy ?? op.suggested_policy;
  return { template: policy ? policyAdapter.fromApi(policy) : null, owner: op.owner_field ?? "" };
}

/** Error de guardar la política → texto (los códigos los da la API). */
function actionError(error: unknown, t: Translate) {
  if (error instanceof ApiError) {
    if (error.code === "policy.owner_field_required")
      return { title: t("errors.ownerTitle"), text: t("errors.ownerText") };
    if (error.code === "operation.retired") return { title: t("errors.retired") };
    if (error.code === "operation.not_found" || error.status === 404)
      return { title: t("errors.notFound") };
    if (error.status === 429) return { title: t("errors.rateLimited") };
    if (error.requestId)
      return { title: t("errors.failed"), text: t("errors.reference", { id: error.requestId }) };
  }
  return { title: t("errors.failed") };
}

/** Problema de una fila antes de enviarla: plantilla elegida y campo propietario si lo exige. */
function rowProblem(draft: RowDraft): "template" | "owner" | null {
  if (!draft.template) return "template";
  if (NEEDS_OWNER.includes(draft.template) && !draft.owner.trim()) return "owner";
  return null;
}

function Policy({ project, data }: { project: Project; data: OperationPage }) {
  const t = useTranslations("Policy");
  const format = useFormatter();
  const http = useHttpClient();
  const toast = useToast();
  const client = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [invalid, setInvalid] = useState<Record<string, "template" | "owner">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState<PolicyTemplate>("ownerOrAdmin");
  const [bulkOwner, setBulkOwner] = useState("");
  const [bulkError, setBulkError] = useState(false);

  const current = data.items.filter((op) => op.retired_at === null);
  // Una operación retirada con política es una regla huérfana: no se usa en las pruebas.
  const orphans = data.items.filter((op) => op.retired_at !== null && op.policy !== null);
  const confirmed = current.filter((op) => op.policy !== null && !drafts[op.id]).length;
  const proposed = current.length - confirmed;
  const dirtyIds = Object.keys(drafts);
  const lastModified = current
    .map((op) => op.modified_at)
    .filter((x): x is string => x !== null)
    .sort()
    .at(-1);

  const visible = current.filter((op) => {
    if (filter === "all") return true;
    const isConfirmed = op.policy !== null && !drafts[op.id];
    return filter === "confirmed" ? isConfirmed : !isConfirmed;
  });
  const byPath = new Map<string, Operation[]>();
  for (const op of visible) byPath.set(op.path, [...(byPath.get(op.path) ?? []), op]);
  const groups = [...byPath.entries()];

  const rowOf = (op: Operation) => drafts[op.id] ?? initialOf(op);

  function edit(op: Operation, change: Partial<RowDraft>) {
    const next = { ...rowOf(op), ...change };
    const initial = initialOf(op);
    const same =
      op.policy !== null && next.template === initial.template && next.owner === initial.owner;
    setDrafts((prev) => {
      const copy = { ...prev };
      if (same) delete copy[op.id];
      else copy[op.id] = next;
      return copy;
    });
    setInvalid((prev) => {
      const copy = { ...prev };
      delete copy[op.id];
      return copy;
    });
  }

  async function refresh(ids: string[]) {
    await client.invalidateQueries({ queryKey: operationsKey(project.id) });
    void client.invalidateQueries({ queryKey: projectKey(project.id), exact: true });
    setDrafts((prev) => {
      const copy = { ...prev };
      for (const id of ids) delete copy[id];
      return copy;
    });
  }

  /** Confirma una o varias filas con `updateOperation`, una tras otra; se detiene al primer error. */
  async function save(ops: Operation[]) {
    if (busy) return;
    const problems: Record<string, "template" | "owner"> = {};
    for (const op of ops) {
      const problem = rowProblem(rowOf(op));
      if (problem) problems[op.id] = problem;
    }
    setInvalid(problems);
    if (Object.keys(problems).length > 0) {
      toast.show({ type: "error", title: t("errors.ownerTitle"), text: t("errors.ownerText") });
      return;
    }
    setBusy(ops.length === 1 ? ops[0].id : "all");
    const done: string[] = [];
    try {
      for (const op of ops) {
        const row = rowOf(op);
        const template = row.template as PolicyTemplate;
        await updateOperation(http, project.id, op.id, {
          policy: policyAdapter.toApi(template),
          owner_field: NEEDS_OWNER.includes(template) ? row.owner.trim() : null,
        });
        done.push(op.id);
      }
      toast.show({ type: "success", title: t("saved") });
    } catch (error) {
      const failed = ops[done.length];
      if (failed && error instanceof ApiError && error.code === "policy.owner_field_required") {
        setInvalid({ [failed.id]: "owner" });
      }
      toast.show({ type: "error", ...actionError(error, t) });
    } finally {
      await refresh(done);
      setBusy(null);
    }
  }

  /** RF-42. Una plantilla para las filas elegidas con `applyPolicy`: todo o nada. */
  async function applyBulk() {
    if (busy) return;
    const needsOwner = NEEDS_OWNER.includes(bulk);
    if (needsOwner && !bulkOwner.trim()) return setBulkError(true);
    setBulkError(false);
    setBusy("bulk");
    try {
      await applyPolicy(http, project.id, {
        operation_ids: selected,
        policy: policyAdapter.toApi(bulk),
        owner_field: needsOwner ? bulkOwner.trim() : null,
      });
      await refresh(selected);
      setSelected([]);
      toast.show({ type: "success", title: t("bulk.done", { count: selected.length }) });
    } catch (error) {
      toast.show({ type: "error", ...actionError(error, t) });
    } finally {
      setBusy(null);
    }
  }

  const filters: [Filter, string][] = [
    ["all", t("filters.all", { count: current.length })],
    ["proposed", t("filters.proposed", { count: proposed })],
    ["confirmed", t("filters.confirmed", { count: confirmed })],
  ];

  return (
    <>
      <UnsavedChangesGuard dirty={dirtyIds.length > 0} />
      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="policy-progress"
          className="border-line flex min-w-0 flex-[999_1_480px] flex-col gap-3.5 rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-7"
        >
          <h2
            id="policy-progress"
            className="font-display text-4xl leading-none font-medium tracking-[-0.03em]"
          >
            {t("progress.title", { confirmed, total: current.length })}
          </h2>
          <div
            role="progressbar"
            aria-label={t("progress.label")}
            aria-valuenow={confirmed}
            aria-valuemin={0}
            aria-valuemax={current.length}
            className="bg-track h-2.5 overflow-hidden rounded-[5px]"
          >
            <div
              className="bg-accent h-full rounded-[5px]"
              style={{ width: `${current.length ? (confirmed / current.length) * 100 : 0}%` }}
            />
          </div>
          <p className="text-muted text-sm leading-[1.55]">
            {proposed > 0 ? `${t("progress.text", { count: proposed })} ` : null}
            {/* TODO(api): `Operation` no dice quién la modificó (RF-43); solo `modified_at`. */}
            {lastModified
              ? t("progress.modified", {
                  date: format.dateTime(new Date(lastModified), {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  }),
                })
              : null}
          </p>
        </section>

        <section
          aria-labelledby="policy-templates"
          className="border-line bg-panel flex min-w-[300px] flex-[1_1_360px] flex-col gap-3 rounded-[28px] border p-6 backdrop-blur-lg"
        >
          <h2 id="policy-templates" className="text-lg font-semibold">
            {t("templates.title")}
          </h2>
          <dl className="m-0 flex flex-col gap-2">
            {TEMPLATES.map((tpl) => (
              <div key={tpl} className="flex flex-col gap-0.5">
                <dt className="text-sm font-semibold">{t(`template.${tpl}`)}</dt>
                <dd className="text-muted m-0 text-[13px] leading-[1.45]">
                  {t(`templates.${tpl}`)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {orphans.length > 0 ? (
        <Banner title={t("orphan.title", { count: orphans.length })}>
          {t("orphan.text")}{" "}
          {orphans.map((op, i) => (
            <span key={op.id}>
              {i > 0 ? ", " : null}
              <code className="font-mono">
                {op.method} {op.path}
              </code>
            </span>
          ))}
        </Banner>
      ) : null}

      <section
        aria-labelledby="policy-ops"
        className="border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="policy-ops" className="text-lg font-semibold">
            {t("operations")}
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="radiogroup"
              aria-label={t("filters.label")}
              className="border-line bg-panel-2 flex gap-1 rounded-2xl border p-1"
            >
              {filters.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "min-h-10 cursor-pointer rounded-xl px-3.5 text-[13.5px] font-semibold",
                    filter === value ? "bg-accent text-on-accent" : "text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              onClick={() => void save(current.filter((op) => drafts[op.id]))}
              disabled={dirtyIds.length === 0 || busy !== null}
              loading={busy === "all"}
            >
              <Icon name="check" size={18} />
              {t("save")}
            </Button>
          </div>
        </div>

        {selected.length > 0 ? (
          <div
            role="toolbar"
            aria-label={t("bulk.label")}
            className="border-accent bg-selected flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
          >
            <b className="text-sm">{t("bulk.selected", { count: selected.length })}</b>
            <label htmlFor="policy-bulk" className="text-muted text-sm">
              {t("bulk.apply")}
            </label>
            <select
              id="policy-bulk"
              value={bulk}
              onChange={(e) => setBulk(e.target.value as PolicyTemplate)}
              className={cn(inputClass, "min-h-10 w-auto text-sm")}
            >
              {TEMPLATES.map((tpl) => (
                <option key={tpl} value={tpl}>
                  {t(`template.${tpl}`)}
                </option>
              ))}
            </select>
            {NEEDS_OWNER.includes(bulk) ? (
              <>
                <label htmlFor="policy-bulk-owner" className="sr-only">
                  {t("bulk.owner")}
                </label>
                <input
                  id="policy-bulk-owner"
                  value={bulkOwner}
                  maxLength={200}
                  placeholder={t("ownerPlaceholder")}
                  onChange={(e) => {
                    setBulkOwner(e.target.value);
                    setBulkError(false);
                  }}
                  aria-invalid={bulkError ? true : undefined}
                  className={cn(inputClass, "min-h-10 w-[200px] text-sm")}
                />
              </>
            ) : null}
            <Button
              size="sm"
              loading={busy === "bulk"}
              disabled={busy !== null}
              onClick={() => void applyBulk()}
            >
              {t("bulk.button")}
            </Button>
            {bulkError ? (
              <span role="alert" className="basis-full text-[13px]">
                {t("errors.ownerText")}
              </span>
            ) : null}
          </div>
        ) : null}

        {current.length === 0 ? (
          <EmptyState title={t("empty.title")} text={t("empty.text")} />
        ) : visible.length === 0 ? (
          <NoResultsState onClear={() => setFilter("all")} />
        ) : (
          <div className="flex flex-col gap-3.5">
            {groups.map(([path, ops]) => (
              <div
                key={path}
                className="border-line bg-panel-2 flex flex-col gap-2 rounded-[20px] border p-3.5"
              >
                <code className="text-muted px-1 font-mono text-[13px]">{path}</code>
                {ops.map((op) => {
                  const row = rowOf(op);
                  const isConfirmed = op.policy !== null && !drafts[op.id];
                  const bad = invalid[op.id];
                  const params = op.parameters.filter((p) => p.location === "path");
                  return (
                    <div
                      key={op.id}
                      className={cn(
                        "flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2",
                        isConfirmed ? "border-line border-solid" : "border-warning border-dashed",
                        bad && "border-danger",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(op.id)}
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked ? [...ids, op.id] : ids.filter((x) => x !== op.id),
                          )
                        }
                        aria-label={t("select", { method: op.method, path: op.path })}
                        className="accent-accent size-5"
                      />
                      <MethodBadge method={op.method} />
                      <code className="min-w-40 flex-1 font-mono text-[13.5px] break-all">
                        {op.path}
                      </code>
                      <span className="text-muted min-w-16 text-[13px]">
                        {op.security.map((s) => s.scheme).join(", ") || t("noSecurity")}
                      </span>
                      <select
                        aria-label={t("templateOf", { method: op.method, path: op.path })}
                        value={row.template ?? ""}
                        aria-invalid={bad === "template" ? true : undefined}
                        onChange={(e) =>
                          edit(op, { template: (e.target.value || null) as PolicyTemplate | null })
                        }
                        className={cn(inputClass, "min-h-10 w-auto text-sm")}
                      >
                        {row.template === null ? <option value="">{t("noTemplate")}</option> : null}
                        {TEMPLATES.map((tpl) => (
                          <option key={tpl} value={tpl}>
                            {t(`template.${tpl}`)}
                          </option>
                        ))}
                      </select>
                      {row.template && NEEDS_OWNER.includes(row.template) ? (
                        <>
                          <input
                            aria-label={t("ownerOf", { method: op.method, path: op.path })}
                            value={row.owner}
                            maxLength={200}
                            list={params.length ? `owner-${op.id}` : undefined}
                            placeholder={t("ownerPlaceholder")}
                            aria-invalid={bad === "owner" ? true : undefined}
                            onChange={(e) => edit(op, { owner: e.target.value })}
                            className={cn(inputClass, "min-h-10 w-[200px] text-sm")}
                          />
                          {params.length ? (
                            <datalist id={`owner-${op.id}`}>
                              {params.map((p) => (
                                <option key={p.name} value={p.name} />
                              ))}
                            </datalist>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted text-[13px]">{t("notApplicable")}</span>
                      )}
                      <span className="flex w-36 items-center gap-2 text-sm">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-2 rounded-full",
                            isConfirmed ? "bg-success" : "bg-warning",
                          )}
                        />
                        {isConfirmed
                          ? t("status.confirmed")
                          : drafts[op.id]
                            ? t("status.changed")
                            : t("status.proposed")}
                      </span>
                      {!isConfirmed ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="min-h-9 rounded-xl px-3 text-[13px]"
                          loading={busy === op.id}
                          disabled={busy !== null}
                          onClick={() => void save([op])}
                        >
                          {t("confirm")}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <span className="text-muted text-[13px]">
          {t("showing", { shown: visible.length, total: data.total })}{" "}
          <Link href={`/projects/${project.id}/contract`} className="text-link">
            {t("viewContract")}
          </Link>
        </span>
      </section>
    </>
  );
}

function PolicyLoader({ project }: { project: Project }) {
  const t = useTranslations("Policy");
  const query = useOperations(project.id, {
    pageSize: PAGE_SIZE,
    includeRetired: true,
    enabled: project.current_contract !== null,
  });
  if (!project.current_contract) {
    return (
      <EmptyState
        title={t("noContract.title")}
        text={t("noContract.text")}
        action={{ label: t("noContract.action"), href: `/projects/${project.id}/contract` }}
      />
    );
  }
  return (
    <QueryState query={query} subject={t("subject")} skeleton={<TablePageSkeleton />}>
      {(data) => <Policy project={project} data={data} />}
    </QueryState>
  );
}

/** V-24. Política de acceso: quién debería poder ejecutar cada operación (RF-39 a RF-43, RN-08). */
export function PolicyView({ id }: { id: string }) {
  const t = useTranslations("Policy");
  return (
    <ProjectShell
      id={id}
      section={t("crumb")}
      title={t("title")}
      render={(project) => <PolicyLoader key={project.id} project={project} />}
    />
  );
}
