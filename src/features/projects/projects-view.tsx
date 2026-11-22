"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { DeleteDialog } from "@/components/dialogs/delete-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { ListPageSkeleton } from "@/components/skeletons/page-skeletons";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { QueryState } from "@/components/ui/query-state";
import { EmptyState } from "@/components/ui/state-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { inputClass } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/features/account/api";
import { Link, useRouter } from "@/i18n/navigation";
import type { ProjectSummary } from "@/lib/api/schemas/projects";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { deleteProject, useProjectList, useRefreshProjects, type ProjectSort } from "./api";

type Order = "lastRun" | "name" | "createdAt";

/** Orden de la vista → `sort` del contrato; la API ordena y pagina (RF-12). */
const SORT: Record<Order, ProjectSort> = {
  lastRun: "-last_run_at",
  name: "name",
  createdAt: "-created_at",
};

const PAGE_SIZE = 20;

function ProjectCard({ project, onDelete }: { project: ProjectSummary; onDelete: () => void }) {
  const t = useTranslations("Projects");
  const format = useFormatter();
  const router = useRouter();
  const href = `/projects/${project.id}`;

  const verified = project.verification_status === "verified";
  // TODO(api): `ProjectSummary` no dice si hay una ejecución en curso, así que la tarjeta no
  // muestra el progreso ni el acceso directo a la ejecución.
  const action =
    !verified && !project.concluded
      ? { label: t("verify"), href: `${href}/verification` }
      : { label: t("open"), href };

  const lastRun = project.last_run_at
    ? format.dateTime(new Date(project.last_run_at), { dateStyle: "medium", timeZone: "UTC" })
    : t("noRuns");

  return (
    <li className="border-line bg-panel flex flex-col gap-[18px] rounded-[28px] border p-6 backdrop-blur-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">
            <Link href={href} className="text-fg no-underline">
              {project.name}
            </Link>
          </h2>
          <code className="text-muted font-mono text-[13px] break-all">{project.base_url}</code>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label={t("moreActions", { name: project.name })}
            className="border-line bg-panel-2 text-fg inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[14px] border"
          >
            <Icon name="more" size={20} strokeWidth={3} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="border-line-strong bg-menu text-fg data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out z-50 min-w-[200px] origin-top-right rounded-[20px] border p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            >
              <DropdownMenu.Item
                onSelect={() => router.push(href)}
                className="data-[highlighted]:bg-selected flex min-h-11 cursor-pointer items-center rounded-[14px] px-3 text-[14.5px] outline-none"
              >
                {t("open")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => router.push(`${href}/settings`)}
                className="data-[highlighted]:bg-selected flex min-h-11 cursor-pointer items-center rounded-[14px] px-3 text-[14.5px] outline-none"
              >
                {t("settings")}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="bg-line my-1 h-px" />
              <DropdownMenu.Item
                onSelect={onDelete}
                className="text-danger data-[highlighted]:bg-danger-bg flex min-h-11 cursor-pointer items-center rounded-[14px] px-3 text-[14.5px] outline-none"
              >
                {t("delete")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="flex flex-wrap gap-2">
        {project.concluded ? <StatusBadge kind="project" status="concluded" /> : null}
        {verified ? (
          <StatusBadge kind="project" status="verified" />
        ) : (
          <StatusBadge kind="project" status="pendingVerification" />
        )}
      </div>

      <div className="border-line bg-panel-2 flex flex-wrap items-end justify-between gap-4 rounded-[20px] border px-[18px] py-4">
        <div className="flex flex-col gap-1">
          <span className="font-display text-4xl leading-none font-medium tracking-[-0.03em] tabular-nums">
            {project.open_findings}
          </span>
          <span className="text-muted text-[13px]">{t("openFindings")}</span>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="text-[15px] font-semibold">{lastRun}</span>
          <span className="text-muted text-[13px]">{t("lastRun")}</span>
        </div>
      </div>

      <ButtonLink href={action.href} variant="secondary" size="sm">
        {action.label}
        <Icon name="chevronRight" size={16} />
      </ButtonLink>
    </li>
  );
}

/** V-13. Lista de proyectos del analista (`listProjects`): resumen, orden, páginas y acciones. */
export function ProjectsView() {
  const t = useTranslations("Projects");
  const toast = useToast();
  const http = useHttpClient();
  const refresh = useRefreshProjects();
  const [order, setOrder] = useState<Order>("lastRun");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null);
  const list = useProjectList({ page, pageSize: PAGE_SIZE, sort: SORT[order] });

  return (
    <>
      <QueryState
        query={list}
        subject={t("subject")}
        skeleton={<ListPageSkeleton label={t("loading")} />}
      >
        {(data) => {
          if (data.total === 0) {
            return (
              <EmptyState
                title={t("empty.title")}
                text={t("empty.text")}
                action={{ label: t("empty.action"), href: "/projects/new" }}
              />
            );
          }
          const pages = Math.max(1, Math.ceil(data.total / data.page_size));
          // Los totales por estado solo son exactos si la página trae todos los proyectos.
          // TODO(api): `listProjects` no da totales de hallazgos ni de verificación pendiente.
          const complete = data.items.length >= data.total;
          const cells: ["projects" | "open" | "pending", number][] = [["projects", data.total]];
          if (complete) {
            cells.push(["open", data.items.reduce((sum, p) => sum + p.open_findings, 0)]);
            cells.push([
              "pending",
              data.items.filter((p) => p.verification_status !== "verified").length,
            ]);
          }
          return (
            <>
              <dl className="border-line m-0 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4 rounded-[28px] border bg-[image:var(--hero)] px-[26px] py-[22px]">
                {cells.map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <dt className="text-muted order-2 text-[13px]">{t(`summary.${key}`)}</dt>
                    <dd className="font-display order-1 m-0 text-4xl leading-none font-medium tracking-[-0.03em] tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="project-order" className="text-muted text-sm">
                  {t("orderBy")}
                </label>
                <select
                  id="project-order"
                  value={order}
                  onChange={(e) => {
                    setOrder(e.target.value as Order);
                    setPage(1);
                  }}
                  className={cn(inputClass, "bg-panel w-auto pr-9")}
                >
                  <option value="lastRun">{t("order.lastRun")}</option>
                  <option value="name">{t("order.name")}</option>
                  <option value="createdAt">{t("order.createdAt")}</option>
                </select>
              </div>

              <ul className="stagger m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5 p-0">
                {data.items.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={() => setToDelete(project)}
                  />
                ))}
                <li className="border-line-strong flex flex-col justify-center gap-3.5 rounded-[28px] border-2 border-dashed p-7">
                  <span
                    aria-hidden="true"
                    className="bg-progress-bg text-accent inline-flex size-12 items-center justify-center rounded-2xl"
                  >
                    <Icon name="plus" size={24} />
                  </span>
                  <b className="text-[17px]">{t("addAnother.title")}</b>
                  <span className="text-muted text-sm leading-[1.55]">{t("addAnother.text")}</span>
                  <Link href="/projects/new" className="text-link text-[15px] font-bold">
                    {t("newProject")}
                  </Link>
                </li>
              </ul>

              {pages > 1 ? (
                <nav
                  aria-label={t("pagination.label")}
                  className="flex items-center justify-between gap-3"
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={data.page <= 1}
                    onClick={() => setPage(data.page - 1)}
                  >
                    {t("pagination.previous")}
                  </Button>
                  <span className="text-muted text-sm" aria-live="polite">
                    {t("pagination.status", { page: data.page, pages })}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={data.page >= pages}
                    onClick={() => setPage(data.page + 1)}
                  >
                    {t("pagination.next")}
                  </Button>
                </nav>
              ) : null}
            </>
          );
        }}
      </QueryState>

      <DeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("deleteDialog.title", { name: toDelete?.name ?? "" })}
        description={t("deleteDialog.description")}
        confirmText={toDelete?.name ?? ""}
        consequences={{
          heading: t("deleteDialog.removed"),
          items: [t("deleteDialog.removed1"), t("deleteDialog.removed2")],
        }}
        confirmLabel={t("deleteDialog.confirm")}
        mapError={(error) => deleteErrorMessage(error, t)}
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteProject(http, toDelete.id, toDelete.name);
          refresh.removeProject(toDelete.id);
          await refresh.projects();
          toast.show({ type: "success", title: t("deleteDialog.done", { name: toDelete.name }) });
        }}
      />
    </>
  );
}

/** Errores de `deleteProject` que la persona puede resolver (CU-06 E2). */
export function deleteErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations<"Projects">>,
) {
  if (error instanceof ApiError && error.code === "project.active_run") {
    return { title: t("deleteDialog.activeRun"), text: t("deleteDialog.activeRunText") };
  }
  if (error instanceof ApiError && error.code === "project.confirmation_mismatch") {
    return { title: t("deleteDialog.mismatch") };
  }
  if (error instanceof ApiError && error.status === 429) {
    return { title: t("deleteDialog.rateLimited") };
  }
  return {
    title: t("deleteDialog.failed"),
    text:
      error instanceof ApiError && error.requestId
        ? t("reference", { id: error.requestId })
        : undefined,
  };
}

/** Pantalla completa de V-13: marco autenticado con el saludo y «Nuevo proyecto». */
export function ProjectsScreen() {
  const t = useTranslations("Projects");
  const me = useMe();
  const firstName = me.data?.name.split(/\s+/)[0];
  return (
    <AppShell
      role="analyst"
      title={t("title")}
      // TODO(api): la API no da cuántas ejecuciones hay en curso; el saludo ya no las cuenta.
      subtitle={firstName ? t("greetingName", { name: firstName }) : undefined}
      actions={
        <ButtonLink href="/projects/new">
          <Icon name="plus" size={18} strokeWidth={2.4} />
          {t("newProject")}
        </ButtonLink>
      }
    >
      <ProjectsView />
    </AppShell>
  );
}
