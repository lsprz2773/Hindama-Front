"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import type { Crumb } from "@/components/layout/breadcrumb";
import type { SidebarProject } from "@/components/layout/sidebar";
import { ErrorPanel } from "@/features/errors/error-panel";
import { SESSION_STUB } from "@/features/account/service";
import { useProject, type Project } from "./store";

/** Texto de las notas de la barra lateral y bloqueos según el estado del proyecto. */
export function useProjectNav(project: Project): SidebarProject {
  const t = useTranslations("ProjectNav");
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

interface ProjectShellProps {
  id: string;
  /** Texto de la última miga (sección actual). `null` = es el dashboard. */
  section?: string;
  /** Migas intermedias y final bajo el proyecto (en lugar de `section`). */
  trail?: Crumb[];
  title: string | ((project: Project) => string);
  subtitle?: string | ((project: Project) => string);
  actions?: ReactNode;
  children: (project: Project) => ReactNode;
}

/**
 * Marco de las vistas de un proyecto: busca el proyecto, arma la barra lateral y la ruta, y
 * muestra el 404 si no existe o no es del analista (RNF-05: un proyecto ajeno responde 404).
 */
export function ProjectShell({
  id,
  section,
  trail,
  title,
  subtitle,
  actions,
  children,
}: ProjectShellProps) {
  const project = useProject(id);
  if (!project) return <ErrorPanel code={404} />;
  return (
    <ProjectShellInner
      project={project}
      section={section}
      trail={trail}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </ProjectShellInner>
  );
}

function ProjectShellInner({
  project,
  section,
  trail,
  title,
  subtitle,
  actions,
  children,
}: Omit<ProjectShellProps, "id"> & { project: Project }) {
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
      userName={SESSION_STUB.name}
      project={nav}
      breadcrumb={crumbs}
      title={typeof title === "function" ? title(project) : title}
      subtitle={typeof subtitle === "function" ? subtitle(project) : subtitle}
      actions={actions}
    >
      {children(project)}
    </AppShell>
  );
}
