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
import { useProject } from "./api";

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
    // «Recursos» siempre abre: solo «Descubrir recursos» exige verificar y lo explica (F-04).
  };
}

interface ProjectShellProps {
  id: string;
  /** Texto de la última miga (sección actual). `null` = es el dashboard. */
  section?: string;
  /** Migas intermedias y final bajo el proyecto (en lugar de `section`). */
  trail?: Crumb[];
  title: string | ((project: ApiProject) => string);
  subtitle?: string;
  actions?: ReactNode;
  /** Contenido de la vista con el proyecto tal como lo devuelve `getProject`. */
  render: (project: ApiProject) => ReactNode;
}

/**
 * Marco de las vistas de un proyecto: pide el proyecto (`getProject`), arma la barra lateral y
 * la ruta. Un proyecto ajeno o inexistente responde 404 (RNF-05) y se muestra V-12.
 */
export function ProjectShell({ id, ...props }: ProjectShellProps) {
  const t = useTranslations("ProjectNav");
  const query = useProject(id);
  if (query.data) {
    return <ProjectShellInner project={query.data} {...props} />;
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
  section,
  trail,
  title,
  subtitle,
  actions,
  render,
}: Omit<ProjectShellProps, "id"> & { project: ApiProject }) {
  const t = useTranslations("ProjectNav");
  const nav = useProjectNav(project);
  const crumbs: Crumb[] = [
    { label: t("projects"), href: "/projects" },
    section || trail
      ? { label: project.name, href: `/projects/${project.id}` }
      : { label: project.name },
    ...(section ? [{ label: section }] : []),
    ...(trail ?? []),
  ];
  return (
    <AppShell
      role="analyst"
      project={nav}
      breadcrumb={crumbs}
      title={typeof title === "function" ? title(project) : title}
      subtitle={subtitle}
      actions={actions}
    >
      {render(project)}
    </AppShell>
  );
}
