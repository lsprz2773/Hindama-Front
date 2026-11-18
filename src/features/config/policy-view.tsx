"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MethodBadge } from "@/components/ui/method-badge";
import { EmptyState, NoResultsState } from "@/components/ui/state-view";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ProjectShell } from "@/features/projects/project-shell";
import type { Project } from "@/features/projects/store";
import {
  POLICY_CONFIRMED_OUTSIDE_SAMPLE,
  POLICY_TOTAL,
  SEED_POLICY,
  type PolicyRow,
  type PolicyTemplate,
} from "./data";
import { useSessionState } from "./use-session-state";

const TEMPLATES: PolicyTemplate[] = ["public", "authenticated", "owner", "ownerOrAdmin", "admin"];
const NEEDS_OWNER: PolicyTemplate[] = ["owner", "ownerOrAdmin"];
const OWNER_FIELDS = ["orderId → userId", "userId"];
type Filter = "all" | "proposed" | "confirmed";

function usePolicyDraft(projectId: string) {
  const t = useTranslations("Policy");
  const toast = useToast();
  const [saved, setSaved] = useSessionState<PolicyRow[]>(
    `hindama.policy.${projectId}`,
    SEED_POLICY,
  );
  const [draft, setDraft] = useState<PolicyRow[]>(saved);
  const [invalid, setInvalid] = useState<string[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function save() {
    // Las plantillas de propiedad necesitan un campo propietario para guardarse.
    const missing = draft
      .filter((r) => NEEDS_OWNER.includes(r.template) && !r.ownerField)
      .map((r) => r.id);
    setInvalid(missing);
    if (missing.length > 0) {
      toast.show({ type: "error", title: t("errors.ownerTitle"), text: t("errors.ownerText") });
      return;
    }
    setSaved(draft);
    toast.show({ type: "success", title: t("saved") });
  }

  return { draft, setDraft, invalid, setInvalid, dirty, save };
}

type PolicyDraft = ReturnType<typeof usePolicyDraft>;

function Policy({ project, policy }: { project: Project; policy: PolicyDraft }) {
  const t = useTranslations("Policy");
  const { draft, setDraft, invalid, setInvalid } = policy;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState<PolicyTemplate>("ownerOrAdmin");
  const [orphan, setOrphan] = useState(true);

  const confirmed = POLICY_CONFIRMED_OUTSIDE_SAMPLE + draft.filter((r) => r.confirmed).length;
  const proposed = POLICY_TOTAL - confirmed;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return draft.filter(
      (r) =>
        (filter === "all" || (filter === "proposed" ? !r.confirmed : r.confirmed)) &&
        (!q || r.path.toLowerCase().includes(q)),
    );
  }, [draft, filter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, PolicyRow[]>();
    for (const row of visible) map.set(row.path, [...(map.get(row.path) ?? []), row]);
    return [...map.entries()];
  }, [visible]);

  function patch(id: string, change: Partial<PolicyRow>) {
    setDraft((rows) => rows.map((r) => (r.id === id ? { ...r, ...change } : r)));
    setInvalid((ids) => ids.filter((x) => x !== id));
  }

  function applyBulk() {
    setDraft((rows) =>
      rows.map((r) =>
        selected.includes(r.id)
          ? {
              ...r,
              template: bulk,
              confirmed: true,
              ownerField: NEEDS_OWNER.includes(bulk) ? (r.ownerField ?? OWNER_FIELDS[0]) : null,
            }
          : r,
      ),
    );
    setSelected([]);
  }

  const filters: [Filter, string][] = [
    ["all", t("filters.all", { count: POLICY_TOTAL })],
    ["proposed", t("filters.proposed", { count: proposed })],
    ["confirmed", t("filters.confirmed", { count: confirmed })],
  ];

  return (
    <>
      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="policy-progress"
          className="border-line flex min-w-0 flex-[999_1_480px] flex-col gap-3.5 rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-7"
        >
          <h2
            id="policy-progress"
            className="font-display text-4xl leading-none font-medium tracking-[-0.03em]"
          >
            {t("progress.title", { confirmed, total: POLICY_TOTAL })}
          </h2>
          <div
            role="progressbar"
            aria-label={t("progress.label")}
            aria-valuenow={confirmed}
            aria-valuemin={0}
            aria-valuemax={POLICY_TOTAL}
            className="bg-track h-2.5 overflow-hidden rounded-[5px]"
          >
            <div
              className="bg-accent h-full rounded-[5px]"
              style={{ width: `${(confirmed / POLICY_TOTAL) * 100}%` }}
            />
          </div>
          <p className="text-muted text-sm leading-[1.55]">
            {t("progress.text", { count: proposed })} {t("progress.modified")}
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

      {orphan ? (
        <Banner
          title={t("orphan.title", { count: 1 })}
          action={
            <Button variant="ghost" size="sm" onClick={() => setOrphan(false)}>
              {t("orphan.remove")}
            </Button>
          }
        >
          {t.rich("orphan.text", { code: (chunks) => <code className="font-mono">{chunks}</code> })}
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
            <label htmlFor="policy-search" className="sr-only">
              {t("search")}
            </label>
            <input
              id="policy-search"
              type="search"
              placeholder={t("search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(inputClass, "min-h-10 w-[220px] text-sm")}
            />
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
            <Button size="sm" onClick={applyBulk}>
              {t("bulk.button")}
            </Button>
          </div>
        ) : null}

        {draft.length === 0 ? (
          <EmptyState title={t("empty.title")} text={t("empty.text")} />
        ) : visible.length === 0 ? (
          <NoResultsState
            onClear={() => {
              setQuery("");
              setFilter("all");
            }}
          />
        ) : (
          <div className="flex flex-col gap-3.5">
            {groups.map(([path, rows]) => (
              <div
                key={path}
                className="border-line bg-panel-2 flex flex-col gap-2 rounded-[20px] border p-3.5"
              >
                <code className="text-muted px-1 font-mono text-[13px]">{path}</code>
                {rows.map((r) => {
                  const bad = invalid.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2",
                        r.confirmed ? "border-line border-solid" : "border-warning border-dashed",
                        bad && "border-danger",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id),
                          )
                        }
                        aria-label={t("select", { method: r.method, path: r.path })}
                        className="accent-accent size-5"
                      />
                      <MethodBadge method={r.method} />
                      <code className="min-w-40 flex-1 font-mono text-[13.5px] break-all">
                        {r.path}
                      </code>
                      <span className="text-muted w-16 text-[13px]">{t("bearer")}</span>
                      <select
                        aria-label={t("templateOf", { method: r.method, path: r.path })}
                        value={r.template}
                        onChange={(e) => {
                          const template = e.target.value as PolicyTemplate;
                          patch(r.id, {
                            template,
                            confirmed: false,
                            ownerField: NEEDS_OWNER.includes(template)
                              ? (r.ownerField ?? null)
                              : null,
                          });
                        }}
                        className={cn(inputClass, "min-h-10 w-auto text-sm")}
                      >
                        {TEMPLATES.map((tpl) => (
                          <option key={tpl} value={tpl}>
                            {t(`template.${tpl}`)}
                          </option>
                        ))}
                      </select>
                      {NEEDS_OWNER.includes(r.template) ? (
                        <select
                          aria-label={t("ownerOf", { method: r.method, path: r.path })}
                          value={r.ownerField ?? ""}
                          aria-invalid={bad ? true : undefined}
                          onChange={(e) => patch(r.id, { ownerField: e.target.value || null })}
                          className={cn(inputClass, "min-h-10 w-auto text-sm")}
                        >
                          <option value="">{t("noOwner")}</option>
                          {OWNER_FIELDS.map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted text-[13px]">{t("notApplicable")}</span>
                      )}
                      <span className="flex w-36 items-center gap-2 text-sm">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-2 rounded-full",
                            r.confirmed ? "bg-success" : "bg-warning",
                          )}
                        />
                        {r.confirmed ? t("status.confirmed") : t("status.proposed")}
                      </span>
                      {!r.confirmed ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="min-h-9 rounded-xl px-3 text-[13px]"
                          onClick={() => patch(r.id, { confirmed: true })}
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
          {t("showing", { shown: visible.length, total: POLICY_TOTAL })}{" "}
          <Link href={`/projects/${project.id}/contract`} className="text-link">
            {t("viewContract")}
          </Link>
        </span>
      </section>
    </>
  );
}

/** V-24. Política de acceso: quién debería poder ejecutar cada operación (RF-39 a RF-43, RN-08). */
export function PolicyView({ id }: { id: string }) {
  const t = useTranslations("Policy");
  const policy = usePolicyDraft(id);
  return (
    <ProjectShell
      id={id}
      section={t("crumb")}
      title={t("title")}
      actions={
        <Button onClick={policy.save} disabled={!policy.dirty}>
          <Icon name="check" size={18} />
          {t("save")}
        </Button>
      }
    >
      {(project) =>
        project.contractOps === null ? (
          <EmptyState
            title={t("noContract.title")}
            text={t("noContract.text")}
            action={{ label: t("noContract.action"), href: `/projects/${id}/contract` }}
          />
        ) : (
          <Policy key={project.id} project={project} policy={policy} />
        )
      }
    </ProjectShell>
  );
}
