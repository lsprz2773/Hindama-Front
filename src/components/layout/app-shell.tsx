import type { ReactNode } from "react";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Breadcrumb, type Crumb } from "./breadcrumb";
import { Sidebar, type SidebarProject } from "./sidebar";
import { UserMenu } from "./user-menu";

interface AppShellProps {
  role: "analyst" | "admin";
  project?: SidebarProject;
  userName: string;
  breadcrumb?: Crumb[];
  title: string;
  subtitle?: string;
  /** Acciones a la derecha del título (solo una primaria por pantalla, §9.1). */
  actions?: ReactNode;
  children: ReactNode;
}

/** Marco de las vistas autenticadas: barra lateral, cabecera con ruta y menú de usuario. */
export function AppShell({
  role,
  project,
  userName,
  breadcrumb,
  title,
  subtitle,
  actions,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="border-line bg-frame flex flex-wrap gap-5 rounded-[34px] border p-4 backdrop-blur-2xl">
        <Sidebar role={role} project={project} />
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5 px-3 pt-3 pb-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
              <h1 className="font-display text-4xl leading-[1.05] font-medium tracking-[-0.025em] sm:text-[40px]">
                {title}
              </h1>
              {subtitle ? <p className="text-muted mt-0.5 text-[15px]">{subtitle}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {actions}
              <UserMenu name={userName} />
            </div>
          </header>
          <main id="main" className="flex flex-col gap-5">
            <OfflineBanner />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
