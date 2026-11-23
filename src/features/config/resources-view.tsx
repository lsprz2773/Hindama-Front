"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { DetailSkeleton, TablePageSkeleton } from "@/components/skeletons/page-skeletons";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MethodBadge } from "@/components/ui/method-badge";
import { QueryState } from "@/components/ui/query-state";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import type { Operation } from "@/lib/api/schemas/contracts";
import type { Identity } from "@/lib/api/schemas/identities";
import type { Project } from "@/lib/api/schemas/projects";
import type { Resource, ResourceDiscovery } from "@/lib/api/schemas/resources";
import { resourceCreateSchema } from "@/lib/api/schemas/resources";
import { fieldErrors } from "@/lib/api/zod";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { hasActiveRun, ProjectShell } from "@/features/projects/project-shell";
import {
  createResource,
  deleteResource,
  discoverResources,
  updateOperation,
  updateResource,
  useAfterPolicy,
  useAfterResources,
  useIdentities,
  useOperations,
  useResources,
} from "./api";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";
/** Una página de `listOperations` admite 500: basta para proponer los identificadores. */
const OPERATIONS_PAGE = 500;
const RESOURCES_PAGE = 100;

type Translate = ReturnType<typeof useTranslations<"Resources">>;

/** Error de una acción sobre un recurso → texto (los códigos los da la API). */
function actionError(error: unknown, t: Translate) {
  if (error instanceof ApiError) {
    if (error.code === "resource.owned_by_other") return { title: t("errors.ownedByOther") };
    if (error.code === "identity.not_found") return { title: t("errors.identityNotFound") };
    if (error.code === "resource.anonymous_owner") return { title: t("errors.anonymousOwner") };
    if (error.status === 404) return { title: t("errors.notFound") };
    if (error.status === 429) return { title: t("errors.rateLimited") };
    if (error.requestId)
      return { title: t("errors.failed"), text: t("errors.reference", { id: error.requestId }) };
  }
  return { title: t("errors.failed") };
}

type Draft = Record<string, { on: boolean; type: string }>;

function draftOf(op: Operation): Draft {
  const draft: Draft = {};
  for (const p of op.parameters.filter((x) => x.location === "path")) {
    const current = op.resource_parameters.find((r) => r.name === p.name);
    draft[p.name] = { on: Boolean(current), type: current?.resource_type ?? "" };
  }
  return draft;
}

/** Parámetros de ruta de una operación y cuáles identifican un recurso (RF-35, `updateOperation`). */
function OperationParams({ project, op }: { project: Project; op: Operation }) {
  const t = useTranslations("Resources");
  const http = useHttpClient();
  const toast = useToast();
  const afterChange = useAfterPolicy(project.id);
  const initial = draftOf(op);
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  async function save() {
    const empty = Object.entries(draft)
      .filter(([, d]) => d.on && !d.type.trim())
      .map(([name]) => name);
    setMissing(empty);
    if (empty.length > 0) return;
    setSaving(true);
    try {
      const updated = await updateOperation(http, project.id, op.id, {
        resource_parameters: Object.entries(draft)
          .filter(([, d]) => d.on)
          .map(([name, d]) => ({ name, resource_type: d.type })),
      });
      setDraft(draftOf(updated));
      afterChange();
      toast.show({ type: "success", title: t("params.saved", { path: op.path }) });
    } catch (error) {
      toast.show({ type: "error", ...actionError(error, t) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="bg-panel-2 flex flex-col gap-2 rounded-2xl px-3.5 py-3">
      <span className="flex flex-wrap items-center gap-2.5">
        <MethodBadge method={op.method} />
        <code className="font-mono text-[13.5px] break-all">{op.path}</code>
      </span>
      {Object.entries(draft).map(([name, d]) => {
        const inputId = `res-type-${op.id}-${name}`;
        return (
          <span
            key={name}
            className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3.5"
          >
            <input
              type="checkbox"
              checked={d.on}
              disabled={saving}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, [name]: { ...d, on: e.target.checked } }))
              }
              aria-label={t("params.isId", { param: name })}
              className="accent-accent size-6"
            />
            <code className="font-mono text-[13.5px] font-semibold break-all">{name}</code>
            <span className="flex flex-col gap-1">
              <label htmlFor={inputId} className="sr-only">
                {t("params.type", { param: name })}
              </label>
              <input
                id={inputId}
                value={d.type}
                disabled={!d.on || saving}
                maxLength={100}
                list="res-types"
                placeholder={t("params.typePlaceholder")}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [name]: { ...d, type: e.target.value } }))
                }
                aria-invalid={missing.includes(name) ? true : undefined}
                className={cn(inputClass, "min-h-10 text-sm")}
              />
              {missing.includes(name) ? (
                <span role="alert" className="text-[13px]">
                  {t("errors.typeRequired")}
                </span>
              ) : null}
            </span>
          </span>
        );
      })}
      {dirty ? (
        <span className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => {
              setDraft(initial);
              setMissing([]);
            }}
          >
            {t("params.discard")}
          </Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>
            {t("params.save")}
          </Button>
        </span>
      ) : null}
    </li>
  );
}

function IdentifierParams({ project }: { project: Project }) {
  const t = useTranslations("Resources");
  const operations = useOperations(project.id, {
    pageSize: OPERATIONS_PAGE,
    enabled: project.current_contract !== null,
  });
  return (
    <section aria-labelledby="res-params" className={cn(card, "min-w-0 flex-[999_1_560px]")}>
      <div className="flex flex-col gap-1">
        <h2 id="res-params" className="text-lg font-semibold">
          {t("params.title")}
        </h2>
        <span className="text-muted text-sm">{t("params.lead")}</span>
      </div>
      {project.current_contract === null ? (
        <p className="text-muted text-sm">{t("params.empty")}</p>
      ) : (
        <QueryState query={operations} subject={t("params.subject")} skeleton={<DetailSkeleton />}>
          {(data) => {
            const withParams = data.items.filter((op) =>
              op.parameters.some((p) => p.location === "path"),
            );
            return withParams.length === 0 ? (
              <p className="text-muted text-sm">{t("params.none")}</p>
            ) : (
              <>
                <ul className="stagger m-0 flex list-none flex-col gap-1.5 p-0">
                  {withParams.map((op) => (
                    <OperationParams
                      key={`${op.id}:${op.modified_at ?? ""}`}
                      project={project}
                      op={op}
                    />
                  ))}
                </ul>
                {data.total > data.items.length ? (
                  <p className="text-muted text-[13px]">
                    {t("params.partial", { shown: data.items.length, total: data.total })}
                  </p>
                ) : null}
              </>
            );
          }}
        </QueryState>
      )}
    </section>
  );
}

/**
 * RF-36. `discoverResources` llama como cada identidad a los GET de listado del contrato. Es
 * síncrona (hasta 25 s) y los recursos nuevos quedan sin confirmar, para revisarlos abajo.
 */
function Discovery({
  project,
  identities,
  total,
}: {
  project: Project;
  identities: Identity[];
  total: number;
}) {
  const t = useTranslations("Resources");
  const http = useHttpClient();
  const toast = useToast();
  const afterChange = useAfterResources(project.id);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResourceDiscovery | null>(null);
  const [failure, setFailure] = useState<{ title: string; text?: string } | null>(null);
  const blocked =
    project.verification_status !== "verified"
      ? t("discover.needsVerified")
      : hasActiveRun(project)
        ? t("discover.activeRun")
        : identities.length === 0
          ? t("discover.noIdentities")
          : null;
  const names = new Map(identities.map((i) => [i.id, i.name]));

  async function discover() {
    if (running || blocked) return;
    setRunning(true);
    setFailure(null);
    try {
      const found = await discoverResources(http, project.id);
      setResult(found);
      afterChange();
      toast.show({
        type: "success",
        title:
          found.created.length > 0
            ? t("discover.done", { count: found.created.length })
            : t("discover.doneNone"),
      });
    } catch (error) {
      setResult(null);
      setFailure(discoveryError(error, t));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section
      aria-labelledby="res-discover"
      className="border-line flex min-w-[300px] flex-[1_1_320px] flex-col gap-4 rounded-[28px] border bg-[image:var(--hero)] p-7"
    >
      <h2 id="res-discover" className="text-lg font-semibold">
        {t("discover.title")}
      </h2>
      <p className="text-muted text-[14.5px] leading-[1.55]">
        {t.rich("discover.text", {
          code: (chunks) => <code className="font-mono">{chunks}</code>,
        })}
      </p>
      <Button
        loading={running}
        disabled={blocked !== null}
        aria-describedby="res-discover-hint"
        onClick={() => void discover()}
      >
        <Icon name="search" size={18} />
        {t("discover.button")}
      </Button>
      <p id="res-discover-hint" className="text-muted text-[13px]">
        {running ? t("discover.running") : (blocked ?? t("discover.hint"))}
      </p>
      <div aria-live="polite" className="flex flex-col gap-3">
        {failure ? (
          <Banner tone="danger" title={failure.title}>
            {failure.text}
          </Banner>
        ) : null}
        {result ? <DiscoveryResult result={result} names={names} /> : null}
      </div>
      <dl className="border-line bg-panel-2 m-0 flex flex-col gap-0.5 rounded-[20px] border px-[18px] py-4">
        <dt className="text-muted order-2 text-[13px]">{t("discover.registered")}</dt>
        <dd className="font-display order-1 m-0 text-[28px] leading-none font-medium tabular-nums">
          {total}
        </dd>
      </dl>
    </section>
  );
}

/** Qué pasó con cada identidad; la evidencia llega como contadores, nunca como texto del servidor. */
function DiscoveryResult({
  result,
  names,
}: {
  result: ResourceDiscovery;
  names: Map<string, string>;
}) {
  const t = useTranslations("Resources");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">
        {t("discover.summary", { count: result.created.length, requests: result.requests_sent })}
      </p>
      {result.truncated ? (
        <Banner title={t("discover.truncated.title")}>{t("discover.truncated.text")}</Banner>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {result.identities.map((item) => (
          <li
            key={item.identity_id}
            className="bg-panel-2 flex flex-col gap-0.5 rounded-2xl px-3.5 py-2.5"
          >
            <span className="text-[14.5px] font-semibold break-words">
              {names.get(item.identity_id) ?? t("discover.unknownIdentity")}
            </span>
            <span className="text-muted text-[13px]">
              {item.failure
                ? t(`discover.failure.${item.failure}`)
                : t("discover.identityLine", {
                    found: item.found,
                    created: item.created,
                    other: item.owned_by_other,
                  })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Error de `discoverResources` → texto (los códigos los da la API). */
function discoveryError(error: unknown, t: Translate) {
  if (error instanceof ApiError) {
    if (error.code === "project.not_verified") return { title: t("errors.notVerified") };
    if (error.code === "project.active_run") return { title: t("errors.activeRun") };
    if (error.code === "resource.no_list_operations")
      return { title: t("errors.noListOperations") };
    if (error.code === "request.timeout") return { title: t("errors.discoveryTimeout") };
  }
  return actionError(error, t);
}

function ResourceList({
  project,
  identity,
  types,
}: {
  project: Project;
  identity: Identity;
  types: string[];
}) {
  const t = useTranslations("Resources");
  const http = useHttpClient();
  const toast = useToast();
  const afterChange = useAfterResources(project.id);
  const [page, setPage] = useState(1);
  const query = useResources(project.id, {
    identityId: identity.id,
    page,
    pageSize: RESOURCES_PAGE,
  });
  const [toDelete, setToDelete] = useState<Resource | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [type, setType] = useState(types[0] ?? "");
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState<{ type?: string; value?: string }>({});
  const [adding, setAdding] = useState(false);

  async function confirm(resource: Resource) {
    if (confirming) return;
    setConfirming(resource.id);
    try {
      await updateResource(http, project.id, resource.id, { confirmed: true });
      afterChange();
    } catch (error) {
      toast.show({ type: "error", ...actionError(error, t) });
    } finally {
      setConfirming(null);
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (adding) return;
    const parsed = resourceCreateSchema.safeParse({
      identity_id: identity.id,
      resource_type: type,
      value,
    });
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      return setErrors({
        type: fields.resource_type ? t("errors.typeRequired") : undefined,
        value: fields.value
          ? value.trim()
            ? t("errors.valueInvalid")
            : t("errors.valueRequired")
          : undefined,
      });
    }
    setErrors({});
    setAdding(true);
    try {
      await createResource(http, project.id, parsed.data);
      afterChange();
      setValue("");
      toast.show({ type: "success", title: t("add.done", { name: identity.name }) });
    } catch (error) {
      if (error instanceof ApiError && error.code === "resource.owned_by_other") {
        setErrors({ value: t("errors.ownedByOther") });
      } else if (error instanceof ApiError && error.status === 422 && error.fieldCode("value")) {
        setErrors({ value: t("errors.valueInvalid") });
      } else {
        toast.show({ type: "error", ...actionError(error, t) });
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <QueryState query={query} subject={t("subject")} skeleton={<TablePageSkeleton rows={3} />}>
        {(data) => {
          const pages = Math.max(1, Math.ceil(data.total / data.page_size));
          return data.items.length === 0 ? (
            <Banner title={t("empty.title", { name: identity.name })}>{t("empty.text")}</Banner>
          ) : (
            <>
              <ul className="stagger m-0 flex list-none flex-col gap-1.5 p-0">
                {data.items.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      "bg-panel-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border px-4 py-2.5",
                      r.confirmed ? "border-line border-solid" : "border-warning border-dashed",
                    )}
                  >
                    <span className="min-w-24 flex-1 text-[14.5px] font-semibold break-words">
                      {r.resource_type}
                    </span>
                    <code className="min-w-[140px] flex-[1.6] font-mono text-[13.5px] break-all">
                      {r.value}
                    </code>
                    <span className="text-muted w-36 text-sm">{t(`origin.${r.source}`)}</span>
                    <span className="flex w-36 items-center gap-2 text-sm">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 rounded-full",
                          r.confirmed ? "bg-success" : "bg-warning",
                        )}
                      />
                      {r.confirmed ? t("status.confirmed") : t("status.pending")}
                    </span>
                    <span className="flex gap-1.5">
                      {!r.confirmed ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="min-h-10 rounded-xl px-3 text-sm"
                          loading={confirming === r.id}
                          disabled={confirming !== null}
                          onClick={() => void confirm(r)}
                        >
                          {t("confirm")}
                        </Button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={t("delete.label", { value: r.value })}
                        onClick={() => setToDelete(r)}
                        className="border-line text-danger inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border"
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </span>
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
          );
        }}
      </QueryState>

      <form
        onSubmit={(e) => void add(e)}
        noValidate
        className="border-line bg-panel-2 flex flex-wrap items-end gap-3 rounded-[20px] border p-4"
      >
        <div className="flex min-w-40 flex-[1_1_160px] flex-col gap-2">
          <label htmlFor="res-kind" className="text-sm font-semibold">
            {t("add.kind")}
          </label>
          <input
            id="res-kind"
            value={type}
            maxLength={100}
            list="res-types"
            onChange={(e) => setType(e.target.value)}
            aria-invalid={errors.type ? true : undefined}
            aria-describedby={errors.type ? "res-kind-error" : undefined}
            className={inputClass}
          />
          {errors.type ? (
            <span id="res-kind-error" role="alert" className="text-[13px]">
              {errors.type}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-60 flex-[2_1_240px] flex-col gap-2">
          <label htmlFor="res-value" className="text-sm font-semibold">
            {t("add.value")}
          </label>
          <input
            id="res-value"
            value={value}
            maxLength={500}
            onChange={(e) => setValue(e.target.value)}
            placeholder="101"
            aria-invalid={errors.value ? true : undefined}
            aria-describedby={errors.value ? "res-value-error" : undefined}
            className={cn(inputClass, "font-mono text-[15px]")}
          />
          {errors.value ? (
            <span id="res-value-error" role="alert" className="text-[13px]">
              {errors.value}
            </span>
          ) : null}
        </div>
        <Button type="submit" variant="secondary" loading={adding}>
          <Icon name="plus" size={16} />
          {t("add.button", { name: identity.name })}
        </Button>
      </form>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("delete.title")}
        description={t("delete.text", { value: toDelete?.value ?? "" })}
        confirmLabel={t("delete.confirm")}
        danger
        mapError={(error) => actionError(error, t)}
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteResource(http, project.id, toDelete.id);
          afterChange();
          toast.show({ type: "success", title: t("delete.done", { value: toDelete.value }) });
        }}
      />
    </>
  );
}

function Resources({ project, identities }: { project: Project; identities: Identity[] }) {
  const t = useTranslations("Resources");
  const base = `/projects/${project.id}`;
  // La identidad anónima no tiene recursos (`resource.anonymous_owner`).
  const named = identities.filter((i) => i.auth_type !== "none");
  const [tab, setTab] = useState(named[0]?.id ?? null);
  const selected = named.find((i) => i.id === tab) ?? named[0] ?? null;
  const total = named.reduce((sum, i) => sum + i.resource_count, 0);
  const operations = useOperations(project.id, {
    pageSize: OPERATIONS_PAGE,
    enabled: project.current_contract !== null,
  });
  // Tipos ya usados en los identificadores, para sugerirlos al agregar un recurso.
  const types = [
    ...new Set(
      (operations.data?.items ?? []).flatMap((op) =>
        op.resource_parameters.map((r) => r.resource_type),
      ),
    ),
  ].sort();

  return (
    <>
      <p className="text-muted -mt-2 max-w-[80ch] text-[15px] leading-[1.55]">{t("lead")}</p>
      <datalist id="res-types">
        {types.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-stretch gap-5">
        <IdentifierParams project={project} />
        <Discovery project={project} identities={named} total={total} />
      </div>

      <section aria-labelledby="res-review" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="res-review" className="text-lg font-semibold">
            {t("review.title")}
          </h2>
          {named.length > 0 ? (
            <div
              role="radiogroup"
              aria-label={t("review.identity")}
              className="border-line bg-panel-2 flex flex-wrap gap-1.5 rounded-2xl border p-1.5"
            >
              {named.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  role="radio"
                  aria-checked={selected?.id === i.id}
                  onClick={() => setTab(i.id)}
                  className={cn(
                    "min-h-[42px] cursor-pointer rounded-[11px] px-4 text-[14.5px] font-semibold",
                    selected?.id === i.id ? "bg-accent text-on-accent" : "text-fg",
                  )}
                >
                  {i.name} · {i.resource_count}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {selected ? (
          <ResourceList key={selected.id} project={project} identity={selected} types={types} />
        ) : (
          <Banner
            title={t("noIdentities.title")}
            action={
              <Link href={`${base}/identities/new`} className="text-link">
                {t("noIdentities.action")}
              </Link>
            }
          >
            {t("noIdentities.text")}
          </Banner>
        )}
      </section>
    </>
  );
}

function ResourcesLoader({ project }: { project: Project }) {
  const t = useTranslations("Resources");
  const query = useIdentities(project.id);
  return (
    <QueryState query={query} subject={t("identitiesSubject")} skeleton={<TablePageSkeleton />}>
      {(data) => <Resources project={project} identities={data.items} />}
    </QueryState>
  );
}

/** V-23. Recursos por identidad: identificadores de ruta y objetos de cada cuenta (RF-35 a RF-38). */
export function ResourcesView({ id }: { id: string }) {
  const t = useTranslations("Resources");
  return (
    <ProjectShell
      id={id}
      section={t("crumb")}
      title={t("title")}
      render={(project) => <ResourcesLoader key={project.id} project={project} />}
    />
  );
}
