"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { DetailSkeleton } from "@/components/skeletons/page-skeletons";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { Banner } from "@/components/ui/banner";
import { Button, ButtonLink } from "@/components/ui/button";
import { MethodBadge } from "@/components/ui/method-badge";
import { QueryState } from "@/components/ui/query-state";
import { EmptyState } from "@/components/ui/state-view";
import { Link } from "@/i18n/navigation";
import type { ContractVersion } from "@/lib/api/schemas/contracts";
import type { Project } from "@/lib/api/schemas/projects";
import { cn } from "@/lib/cn";
import { ProjectShell } from "@/features/projects/project-shell";
import { useContract, useContracts } from "./api";

type Kind = "added" | "modified" | "removed";

const KIND_STYLE: Record<Kind, { sign: string; color: string; bg: string; border: string }> = {
  added: { sign: "+", color: "text-success", bg: "bg-success-bg", border: "border-l-success" },
  modified: { sign: "~", color: "text-warning", bg: "bg-warning-bg", border: "border-l-warning" },
  removed: { sign: "−", color: "text-danger", bg: "bg-danger-bg", border: "border-l-danger" },
};
const KINDS = ["added", "modified", "removed"] as const;
const PAGE_SIZE = 20;

/** Cambios de una versión respecto a la anterior (RF-26), tal como los calcula la API. */
function Changes({ version, base }: { version: ContractVersion; base: string }) {
  const t = useTranslations("ContractVersions");
  const changes = version.changes;
  if (!changes) {
    return (
      <EmptyState title={t("first.title")} text={t("first.text", { number: version.number })} />
    );
  }
  const counts = {
    added: changes.added.length,
    modified: changes.modified.length,
    removed: changes.removed.length,
  };
  const rows = KINDS.flatMap((kind) => changes[kind].map((op) => ({ kind, op })));

  return (
    <>
      <section
        aria-labelledby="versions-diff"
        className="border-line flex flex-col gap-5 rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-[30px]"
      >
        <h2
          id="versions-diff"
          className="font-display text-4xl leading-none font-medium tracking-[-0.03em]"
        >
          {t("diffTitle", { from: `v${version.number}`, to: `v${changes.previous_version}` })}
        </h2>
        <ul className="stagger m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 p-0">
          {KINDS.map((kind) => (
            <li
              key={kind}
              className="border-line bg-panel-2 flex items-center gap-3.5 rounded-[20px] border px-[18px] py-4"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-xl text-xl font-bold",
                  KIND_STYLE[kind].bg,
                  KIND_STYLE[kind].color,
                )}
              >
                {KIND_STYLE[kind].sign}
              </span>
              <span className="flex flex-col">
                <span className="font-display text-[28px] leading-none font-medium tabular-nums">
                  {counts[kind]}
                </span>
                <span className="text-muted text-[13.5px]">
                  {t(`summary.${kind}`, { count: counts[kind] })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {counts.added > 0 ? (
        <Banner title={t("reviewPolicy.title")}>
          {t("reviewPolicy.text", { count: counts.added })}{" "}
          <Link href={`${base}/policy`} className="text-link font-semibold">
            {t("reviewPolicy.link")}
          </Link>
        </Banner>
      ) : null}

      <section
        aria-labelledby="versions-changes"
        className="border-line bg-panel flex flex-col gap-2.5 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <h2 id="versions-changes" className="text-lg font-semibold">
          {t("changes")}
        </h2>
        {rows.length === 0 ? (
          <p className="text-muted text-sm">{t("noChanges")}</p>
        ) : (
          <ul className="stagger m-0 flex list-none flex-col gap-2 p-0">
            {rows.map(({ kind, op }) => {
              const style = KIND_STYLE[kind];
              return (
                <li
                  key={`${kind}:${op.id}`}
                  className={cn(
                    "border-line bg-panel-2 flex flex-wrap items-center gap-3 rounded-[18px] border border-l-4 px-3.5 py-3",
                    style.border,
                  )}
                >
                  <span className="flex min-w-24 items-center gap-1.5 text-[12.5px] font-bold">
                    <span aria-hidden="true" className={cn("text-base", style.color)}>
                      {style.sign}
                    </span>
                    {t(`kind.${kind}`)}
                  </span>
                  <MethodBadge method={op.method} />
                  <code
                    className={cn(
                      "font-mono text-sm break-all",
                      kind === "removed" && "line-through",
                    )}
                  >
                    {op.path}
                  </code>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Versions({ project }: { project: Project }) {
  const t = useTranslations("ContractVersions");
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const list = useContracts(project.id, page, PAGE_SIZE);
  const [selected, setSelected] = useState<string | null>(project.current_contract?.id ?? null);
  const version = useContract(project.id, selected);
  const base = `/projects/${project.id}`;

  if (!project.current_contract) {
    return (
      <EmptyState
        title={t("empty.title")}
        text={t("empty.text")}
        action={{ label: t("empty.action"), href: `${base}/contract` }}
      />
    );
  }
  const currentId = project.current_contract.id;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section
        aria-labelledby="versions-list"
        className="border-line bg-panel flex min-w-[300px] flex-[1_1_320px] flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <QueryState query={list} subject={t("subject")} skeleton={<DetailSkeleton />}>
          {(data) => {
            const pages = Math.max(1, Math.ceil(data.total / data.page_size));
            return (
              <>
                <h2 id="versions-list" className="text-lg font-semibold">
                  {t("count", { count: data.total })}
                </h2>
                <ol className="stagger m-0 flex list-none flex-col gap-2 p-0">
                  {data.items.map((v) => {
                    const current = v.id === currentId;
                    const isSelected = v.id === selected;
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelected(v.id)}
                          className={cn(
                            "bg-panel-2 flex w-full cursor-pointer flex-col gap-1.5 rounded-[20px] border p-4 text-left",
                            isSelected ? "border-accent/55" : "border-line",
                          )}
                        >
                          <span className="flex items-baseline justify-between gap-2.5">
                            <b className="text-base">{t("name", { number: v.number })}</b>
                            <span
                              className={cn(
                                "text-[12.5px] font-bold",
                                current ? "text-success" : "text-link",
                              )}
                            >
                              {current ? t("current") : isSelected ? t("viewing") : ""}
                            </span>
                          </span>
                          <span className="text-muted text-[13.5px]">
                            {format.dateTime(new Date(v.imported_at), {
                              dateStyle: "medium",
                              timeZone: "UTC",
                            })}{" "}
                            · {v.source === "url" ? t("originUrl") : t("originFile")} · OpenAPI{" "}
                            {v.openapi_version}
                          </span>
                          <span className="text-muted text-[13.5px]">
                            {t("operations", { count: v.operation_count })}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {pages > 1 ? (
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1 || list.isFetching}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      {t("previous")}
                    </Button>
                    <span className="text-muted text-[13px]">{t("page", { page, pages })}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= pages || list.isFetching}
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
        {version.data && version.data.warnings.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-muted text-[13px] font-bold">
              {t("warningsOf", { version: `v${version.data.number}` })}
            </span>
            <ApiWarnings warnings={version.data.warnings} />
          </div>
        ) : null}
        <ButtonLink href={`${base}/contract`} variant="secondary">
          {t("back")}
        </ButtonLink>
      </section>

      <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">
        <QueryState query={version} subject={t("versionSubject")} skeleton={<DetailSkeleton />}>
          {(data) => <Changes version={data} base={base} />}
        </QueryState>
      </div>
    </div>
  );
}

/** V-20. Versiones importadas del contrato y los cambios de cada una frente a la anterior (RF-26). */
export function VersionsView({ id }: { id: string }) {
  const t = useTranslations("ContractVersions");
  const c = useTranslations("Contract");
  return (
    <ProjectShell
      id={id}
      trail={[{ label: c("crumb"), href: `/projects/${id}/contract` }, { label: t("crumb") }]}
      title={t("title")}
      render={(project) => <Versions key={project.id} project={project} />}
    />
  );
}
