"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { useMemo, useState } from "react";
import { DeleteDialog } from "@/components/dialogs/delete-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState, NoResultsState } from "@/components/ui/state-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { SESSION_STUB } from "@/features/account/service";
import { Link, useRouter } from "@/i18n/navigation";
import { inputClass } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { deleteProject, useProjects, type Project } from "./store";

type Order = "lastRun" | "name" | "createdAt";

function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const t = useTranslations("Projects");
  const format = useFormatter();
  const router = useRouter();
  const href = `/projects/${project.id}`;

  const action =
    !project.verified && !project.concluded
      ? { label: t("verify"), href: `${href}/verification` }
      : project.running !== undefined
        ? { label: t("viewProgress"), href: `${href}/runs/current` }
        : { label: t("open"), href };

  const lastRun =
    project.running !== undefined
      ? t("now")
      : project.lastRun
        ? format.dateTime(new Date(project.lastRun), { dateStyle: "medium", timeZone: "UTC" })
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
          <code className="text-muted font-mono text-[13px] break-all">{project.baseUrl}</code>
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
        {project.verified ? (
          <StatusBadge kind="project" status="verified" />
        ) : (
          <StatusBadge kind="project" status="pendingVerification" />
        )}
        {project.running !== undefined ? (
          <span className="bg-accent text-on-accent inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-bold">
            {t("runningBadge", { percent: project.running })}
          </span>
        ) : null}
      </div>

      <div className="border-line bg-panel-2 flex flex-wrap items-end justify-between gap-4 rounded-[20px] border px-[18px] py-4">
        <div className="flex flex-col gap-1">
          <span className="font-display text-4xl leading-none font-medium tracking-[-0.03em] tabular-nums">
            {project.openFindings ?? "—"}
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

/** V-13. Lista de proyectos del analista: resumen, búsqueda, orden y tarjetas con acciones. */
export function ProjectsView() {
  const t = useTranslations("Projects");
  const toast = useToast();
  const projects = useProjects();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<Order>("lastRun");
  const [toDelete, setToDelete] = useState<Project | null>(null);

  const summary = useMemo(
    () => ({
      projects: projects.length,
      open: projects.reduce((sum, p) => sum + (p.openFindings ?? 0), 0),
      running: projects.filter((p) => p.running !== undefined).length,
      pending: projects.filter((p) => !p.verified).length,
    }),
    [projects],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = projects.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.baseUrl.toLowerCase().includes(q),
    );
    return [...filtered].sort((a, b) => {
      if (order === "name") return a.name.localeCompare(b.name);
      if (order === "createdAt") return b.createdAt.localeCompare(a.createdAt);
      const ra = a.running !== undefined ? "9999" : (a.lastRun ?? "");
      const rb = b.running !== undefined ? "9999" : (b.lastRun ?? "");
      return rb.localeCompare(ra);
    });
  }, [projects, query, order]);

  if (projects.length === 0) {
    return (
      <EmptyState
        title={t("empty.title")}
        text={t("empty.text")}
        action={{ label: t("empty.action"), href: "/projects/new" }}
      />
    );
  }

  const cells = [
    ["projects", summary.projects],
    ["open", summary.open],
    ["running", summary.running],
    ["pending", summary.pending],
  ] as const;

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
        <div className="relative flex min-w-[240px] flex-[1_1_280px] items-center">
          <span className="text-muted absolute left-4 flex">
            <Icon name="search" size={18} />
          </span>
          <label htmlFor="project-search" className="sr-only">
            {t("search")}
          </label>
          <input
            id="project-search"
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(inputClass, "bg-panel pl-[46px]")}
          />
        </div>
        <label htmlFor="project-order" className="text-muted text-sm">
          {t("orderBy")}
        </label>
        <select
          id="project-order"
          value={order}
          onChange={(e) => setOrder(e.target.value as Order)}
          className={cn(inputClass, "bg-panel w-auto pr-9")}
        >
          <option value="lastRun">{t("order.lastRun")}</option>
          <option value="name">{t("order.name")}</option>
          <option value="createdAt">{t("order.createdAt")}</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <NoResultsState onClear={() => setQuery("")} />
      ) : (
        <ul className="stagger m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5 p-0">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={() => setToDelete(project)} />
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
      )}

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
        onConfirm={async () => {
          if (!toDelete) return;
          await new Promise((resolve) => setTimeout(resolve, 400));
          deleteProject(toDelete.id);
          toast.show({ type: "success", title: t("deleteDialog.done", { name: toDelete.name }) });
        }}
      />
    </>
  );
}

/** Pantalla completa de V-13: marco autenticado con el saludo y «Nuevo proyecto». */
export function ProjectsScreen() {
  const t = useTranslations("Projects");
  const projects = useProjects();
  const running = projects.filter((p) => p.running !== undefined).length;
  return (
    <AppShell
      role="analyst"
      userName={SESSION_STUB.name}
      title={t("title")}
      subtitle={t("greeting", { name: SESSION_STUB.name.split(" ")[0], running })}
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
