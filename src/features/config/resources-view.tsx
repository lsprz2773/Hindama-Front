"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Banner } from "@/components/ui/banner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ProjectShell } from "@/features/projects/project-shell";
import type { Project } from "@/features/projects/store";
import { SEED_PARAMS, SEED_RESOURCES, type ResourceParam, type ResourceRow } from "./data";
import { useIdentities } from "./identities";
import { useSessionState } from "./use-session-state";

const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";
const KINDS = ["order", "user", "address"] as const;
const NONE: Record<string, ResourceRow[]> = {};

function Resources({ project }: { project: Project }) {
  const t = useTranslations("Resources");
  const toast = useToast();
  const base = `/projects/${project.id}`;
  const seeded = project.id === "pedidos";
  const { identities } = useIdentities(project.id);
  const named = identities.filter((i) => !i.fixed);

  const [params, setParams] = useSessionState<ResourceParam[]>(
    `hindama.resource-params.${project.id}`,
    seeded ? SEED_PARAMS : [],
  );
  const [rows, setRows] = useSessionState<Record<string, ResourceRow[]>>(
    `hindama.resources.${project.id}`,
    seeded ? SEED_RESOURCES : NONE,
  );
  const [tab, setTab] = useState(named[0]?.id ?? "");
  const [discovering, setDiscovering] = useState(false);
  const [toDelete, setToDelete] = useState<ResourceRow | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("order");
  const [value, setValue] = useState("");
  const [addError, setAddError] = useState<string>();

  const current = rows[tab] ?? [];
  const all = Object.values(rows).flat();
  const unconfirmed = all.filter((r) => !r.confirmed).length;
  const tabName = named.find((i) => i.id === tab)?.name ?? "";

  async function discover() {
    setDiscovering(true);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // TODO(api): descubrir recursos
    setRows((prev) => {
      const next = { ...prev };
      for (const identity of named) {
        const list = next[identity.id] ?? [];
        next[identity.id] = [
          ...list,
          {
            id: `d${Date.now()}${identity.id}`,
            kind: "order",
            value: `new-${identity.id.slice(0, 3)}-${list.length + 1}`,
            origin: "discovered",
            confirmed: false,
          },
        ];
      }
      return next;
    });
    setDiscovering(false);
    toast.show({ type: "success", title: t("discover.done", { count: named.length }) });
  }

  function addRow(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return setAddError(t("errors.valueRequired"));
    setAddError(undefined);
    setRows((prev) => ({
      ...prev,
      [tab]: [
        ...(prev[tab] ?? []),
        { id: `m${Date.now()}`, kind, value: value.trim(), origin: "manual", confirmed: true },
      ],
    }));
    setValue("");
  }

  const identityIdsMissing = named.length === 0;

  return (
    <>
      <p className="text-muted -mt-2 max-w-[80ch] text-[15px] leading-[1.55]">{t("lead")}</p>

      <div className="flex flex-wrap items-stretch gap-5">
        <section aria-labelledby="res-params" className={cn(card, "min-w-0 flex-[999_1_560px]")}>
          <div className="flex flex-col gap-1">
            <h2 id="res-params" className="text-lg font-semibold">
              {t("params.title")}
            </h2>
            <span className="text-muted text-sm">{t("params.lead")}</span>
          </div>
          {params.length === 0 ? (
            <p className="text-muted text-sm">{t("params.empty")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {params.map((p, i) => (
                <li
                  key={`${p.path}${p.param}`}
                  className="bg-panel-2 grid grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3.5 rounded-2xl px-3.5 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={p.on}
                    onChange={(e) =>
                      setParams((list) =>
                        list.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)),
                      )
                    }
                    aria-label={t("params.isId", { param: p.param })}
                    className="accent-accent size-6"
                  />
                  <code className="font-mono text-[13.5px] break-all">{p.path}</code>
                  <code className="font-mono text-[13.5px] font-semibold">{p.param}</code>
                  <span className="text-muted text-sm">{t(`kinds.${p.kind}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

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
            onClick={() => void discover()}
            loading={discovering}
            disabled={identityIdsMissing}
          >
            {discovering ? null : <Icon name="search" size={18} />}
            {discovering ? t("discover.running") : t("discover.button")}
          </Button>
          <dl className="border-line bg-panel-2 m-0 grid grid-cols-2 gap-3 rounded-[20px] border px-[18px] py-4">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted order-2 text-[13px]">{t("discover.found")}</dt>
              <dd className="font-display order-1 m-0 text-[28px] leading-none font-medium tabular-nums">
                {all.length}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted order-2 text-[13px]">{t("discover.toConfirm")}</dt>
              <dd className="font-display order-1 m-0 text-[28px] leading-none font-medium tabular-nums">
                {unconfirmed}
              </dd>
            </div>
          </dl>
        </section>
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
                  aria-checked={tab === i.id}
                  onClick={() => setTab(i.id)}
                  className={cn(
                    "min-h-[42px] cursor-pointer rounded-[11px] px-4 text-[14.5px] font-semibold",
                    tab === i.id ? "bg-accent text-on-accent" : "text-fg",
                  )}
                >
                  {i.name} · {(rows[i.id] ?? []).length}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {identityIdsMissing ? (
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
        ) : null}

        {tab && current.length === 0 && !identityIdsMissing ? (
          <Banner title={t("empty.title", { name: tabName })}>{t("empty.text")}</Banner>
        ) : null}

        {current.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {current.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "bg-panel-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border px-4 py-2.5",
                  r.confirmed ? "border-line border-solid" : "border-warning border-dashed",
                )}
              >
                <span className="min-w-24 flex-1 text-[14.5px] font-semibold">
                  {t(`kinds.${r.kind}`)}
                </span>
                <code className="min-w-[140px] flex-[1.6] font-mono text-[13.5px] break-all">
                  {r.value}
                </code>
                <span className="text-muted w-36 text-sm">{t(`origin.${r.origin}`)}</span>
                <span className="flex w-36 items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={cn("size-2 rounded-full", r.confirmed ? "bg-success" : "bg-warning")}
                  />
                  {r.confirmed ? t("status.confirmed") : t("status.pending")}
                </span>
                <span className="flex gap-1.5">
                  {!r.confirmed ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-h-10 rounded-xl px-3 text-sm"
                      onClick={() =>
                        setRows((prev) => ({
                          ...prev,
                          [tab]: (prev[tab] ?? []).map((x) =>
                            x.id === r.id ? { ...x, confirmed: true } : x,
                          ),
                        }))
                      }
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
        ) : null}

        {tab ? (
          <form
            onSubmit={addRow}
            noValidate
            className="border-line bg-panel-2 flex flex-wrap items-end gap-3 rounded-[20px] border p-4"
          >
            <div className="flex min-w-40 flex-[1_1_160px] flex-col gap-2">
              <label htmlFor="res-kind" className="text-sm font-semibold">
                {t("add.kind")}
              </label>
              <select
                id="res-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
                className={inputClass}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-60 flex-[2_1_240px] flex-col gap-2">
              <label htmlFor="res-value" className="text-sm font-semibold">
                {t("add.value")}
              </label>
              <input
                id="res-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="8f21c0de"
                aria-invalid={addError ? true : undefined}
                className={cn(inputClass, "font-mono text-[15px]")}
              />
              {addError ? (
                <span role="alert" className="text-[13px]">
                  {addError}
                </span>
              ) : null}
            </div>
            <Button type="submit" variant="secondary">
              <Icon name="plus" size={16} />
              {t("add.button", { name: tabName })}
            </Button>
          </form>
        ) : null}
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("delete.title")}
        description={t("delete.text", { value: toDelete?.value ?? "" })}
        confirmLabel={t("delete.confirm")}
        danger
        onConfirm={async () => {
          if (!toDelete) return;
          setRows((prev) => ({
            ...prev,
            [tab]: (prev[tab] ?? []).filter((x) => x.id !== toDelete.id),
          }));
        }}
      />
    </>
  );
}

/** V-23. Recursos por identidad: identificadores, descubrimiento y revisión de los objetos de cada cuenta. */
export function ResourcesView({ id }: { id: string }) {
  const t = useTranslations("Resources");
  return (
    <ProjectShell id={id} section={t("crumb")} title={t("title")}>
      {(project) =>
        project.verified ? (
          <Resources key={project.id} project={project} />
        ) : (
          <Banner
            title={t("locked.title")}
            action={
              <ButtonLink href={`/projects/${id}/verification`} variant="ghost" size="sm">
                {t("locked.action")}
              </ButtonLink>
            }
          >
            {t("locked.text")}
          </Banner>
        )
      }
    </ProjectShell>
  );
}
