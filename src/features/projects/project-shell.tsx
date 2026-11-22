"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import type { Crumb } from "@/components/layout/breadcrumb";
import type { SidebarProject } from "@/components/layout/sidebar";
import { AppShellSkeleton } from "@/components/skeletons/app-shell-skeleton";
import { DashboardSkeleton } from "@/components/skeletons/page-skeletons";
import { QueryState } from "@/components/ui/query-state";
import type { Project as ApiProject } from "@/lib/api/schemas/projects";
import { ErrorPanel } from "@/features/errors/error-panel";
import { isUuid } from "@/lib/api/zod";
import { useProject } from "./api";
import { SEED_PROJECTS, type Project as LegacyProject } from "./seed";
import { useProject as useLegacyProject } from "./store";

/** La ejecución sigue en cola o en curso: bloquea otra (RN-07). */
export function hasActiveRun(project: ApiProject): boolean {
  return project.last_run?.status === "queued" || project.last_run?.status === "running";
}

/** Notas de la barra lateral y bloqueos, solo con lo que informa `getProject`. */
export function useProjectNav(project: ApiProject | undefined): SidebarProject | undefined {
  const t = useTranslations("ProjectNav");
  if (!project) return undefined;
  const verified = project.verification_status === "verified";
  const findings = project.open_findings_by_severity.total;
  return {
    id: project.id,
    name: project.name,
    // TODO(api): `Project` no trae cuántas identidades, recursos u operaciones sin confirmar hay;
    // esas notas vuelven cuando se conecten sus vistas (fase 4).
    notes: {
      verification: verified ? { text: t("done") } : { text: t("pending"), warning: true },
      contract: project.current_contract
        ? { text: t("operations", { count: project.current_contract.operation_count }) }
        : undefined,
      history: project.last_run ? { text: String(project.last_run.number) } : undefined,
      findings: findings > 0 ? { text: String(findings) } : undefined,
    },
    locked: verified ? undefined : { resources: t("availableAfterVerification") },
  };
}

/** Barra lateral de un proyecto de ejemplo (vistas sin conectar). */
function legacyNav(
  project: LegacyProject,
  t: ReturnType<typeof useTranslations<"ProjectNav">>,
): SidebarProject {
  const unconfirmed = project.policy ? project.policy.total - project.policy.confirmed : 0;
  return {
    id: project.id,
    name: project.name,
    notes: {
      verification: project.verified ? { text: t("done") } : { text: t("pending"), warning: true },
      contract:
        project.contractOps !== null
          ? { text: t("operations", { count: project.contractOps }) }
          : undefined,
      identities: project.identities > 0 ? { text: String(project.identities) } : undefined,
      resources: project.resources > 0 ? { text: String(project.resources) } : undefined,
      policy:
        unconfirmed > 0
          ? { text: t("unconfirmed", { count: unconfirmed }), warning: true }
          : undefined,
      history: project.report ? { text: String(project.report.runNumber) } : undefined,
      findings: project.openFindings ? { text: String(project.openFindings) } : undefined,
    },
    locked: project.verified ? undefined : { resources: t("availableAfterVerification") },
  };
}

/**
 * Proyecto con la forma que aún esperan las vistas sin conectar (fases 4 a 6). Los datos que
 * da `getProject` son reales; lo demás (reporte, política, conteos) sale del ejemplo hasta que
 * esas vistas lean sus propios endpoints.
 * TODO(api): quitarlo cuando no quede ninguna vista que lo use.
 */
export function toLegacyProject(project: ApiProject): LegacyProject {
  const verified = project.verification_status === "verified";
  const demo = verified ? SEED_PROJECTS[0] : SEED_PROJECTS[2];
  return {
    ...demo,
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    baseUrl: project.base_url,
    verified,
    concluded: project.concluded,
    running: hasActiveRun(project) ? 0 : undefined,
    lastRun: project.last_run?.finished_at ?? null,
    openFindings: project.last_run ? project.open_findings_by_severity.total : null,
    contractOps: project.current_contract?.operation_count ?? null,
    createdAt: project.created_at,
  };
}

interface ProjectShellProps {
  id: string;
  /** Texto de la última miga (sección actual). `null` = es el dashboard. */
  section?: string;
  /** Migas intermedias y final bajo el proyecto (en lugar de `section`). */
  trail?: Crumb[];
  title: string | ((project: LegacyProject) => string);
  subtitle?: string | ((project: LegacyProject) => string);
  actions?: ReactNode | ((project: LegacyProject) => ReactNode);
  /** Vistas sin conectar: reciben el proyecto con la forma anterior. */
  children?: (project: LegacyProject) => ReactNode;
  /** Vistas conectadas: reciben el proyecto tal como lo devuelve `getProject`. */
  render?: (project: ApiProject) => ReactNode;
}

/**
 * Marco de las vistas de un proyecto: pide el proyecto (`getProject`), arma la barra lateral y
 * la ruta. Un proyecto ajeno o inexistente responde 404 (RNF-05) y se muestra V-12.
 */
export function ProjectShell({ id, ...props }: ProjectShellProps) {
  // TODO(api): las vistas sin conectar (fases 4 a 6) aún se prueban con los proyectos de ejemplo,
  // que tienen ids legibles («pedidos»). Un id que no es UUID nunca llega a la API.
  if (!isUuid(id) && !props.render) return <LegacyProjectShell id={id} {...props} />;
  return <ApiProjectShell id={id} {...props} />;
}

function LegacyProjectShell({ id, ...props }: ProjectShellProps) {
  const project = useLegacyProject(id);
  if (!project) return <ErrorPanel code={404} />;
  return <ProjectShellInner legacy={project} {...props} />;
}

function ApiProjectShell({ id, ...props }: ProjectShellProps) {
  const t = useTranslations("ProjectNav");
  const query = useProject(id);
  if (query.data) {
    return (
      <ProjectShellInner project={query.data} legacy={toLegacyProject(query.data)} {...props} />
    );
  }
  const skeleton = (
    <AppShellSkeleton withProject>
      <DashboardSkeleton />
    </AppShellSkeleton>
  );
  if (query.status === "pending") return skeleton;
  // Error al pedir el proyecto (404, 403, 429, 5xx…): V-12 dentro del marco, con salida a la lista.
  return (
    <AppShell
      role="analyst"
      breadcrumb={[{ label: t("projects"), href: "/projects" }]}
      title={t("projects")}
    >
      <QueryState query={query} subject={t("subject")} skeleton={skeleton}>
        {() => null}
      </QueryState>
    </AppShell>
  );
}

function ProjectShellInner({
  project,
  legacy,
  section,
  trail,
  title,
  subtitle,
  actions,
  children,
  render,
}: Omit<ProjectShellProps, "id"> & { project?: ApiProject; legacy: LegacyProject }) {
  const t = useTranslations("ProjectNav");
  const apiNav = useProjectNav(project);
  const nav = apiNav ?? legacyNav(legacy, t);
  const name = project?.name ?? legacy.name;
  const id = project?.id ?? legacy.id;
  const crumbs: Crumb[] = [
    { label: t("projects"), href: "/projects" },
    section || trail ? { label: name, href: `/projects/${id}` } : { label: name },
    ...(section ? [{ label: section }] : []),
    ...(trail ?? []),
  ];
  return (
    <AppShell
      role="analyst"
      project={nav}
      breadcrumb={crumbs}
      title={typeof title === "function" ? title(legacy) : title}
      subtitle={typeof subtitle === "function" ? subtitle(legacy) : subtitle}
      actions={typeof actions === "function" ? actions(legacy) : actions}
    >
      {render && project ? render(project) : children?.(legacy)}
    </AppShell>
  );
}
