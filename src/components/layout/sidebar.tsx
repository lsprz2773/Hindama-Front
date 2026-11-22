"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export const PROJECT_ITEMS = [
  { key: "summary", icon: "grid", path: "" },
  { key: "verification", icon: "shield", path: "/verification" },
  { key: "contract", icon: "contract", path: "/contract" },
  { key: "identities", icon: "users", path: "/identities" },
  { key: "resources", icon: "box", path: "/resources" },
  { key: "policy", icon: "list", path: "/policy" },
  { key: "history", icon: "clock", path: "/history" },
  { key: "findings", icon: "alert", path: "/findings" },
  { key: "settings", icon: "gear", path: "/settings" },
] as const satisfies readonly { key: string; icon: IconName; path: string }[];

export type ProjectItemKey = (typeof PROJECT_ITEMS)[number]["key"];

export interface SidebarProject {
  id: string;
  name: string;
  /** Texto corto a la derecha del elemento («42 op.», «3»). */
  notes?: Partial<Record<ProjectItemKey, { text: string; warning?: boolean }>>;
  /** Elementos que aún no se pueden abrir, con el motivo («Disponible tras verificar»). */
  locked?: Partial<Record<ProjectItemKey, string>>;
}

interface SidebarProps {
  role: "analyst" | "admin";
  project?: SidebarProject;
  /** Arranca contraída. */
  collapsed?: boolean;
}

const ADMIN_ITEMS = [
  { key: "statistics", icon: "chart", href: "/admin" },
  { key: "auditLog", icon: "list", href: "/admin/audit-log" },
] as const;

/**
 * C-01 (barra lateral flotante) y C-03 (navegación interna del proyecto, como grupo del mismo
 * menú). Siempre oscura, en ambos temas. El elemento activo sale de la ruta.
 */
export function Sidebar({ role, project, collapsed = false }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const [open, setOpen] = useState(!collapsed);

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label={t("label")}
      className={cn(
        "bg-sidebar flex min-h-[820px] flex-none flex-col gap-1.5 rounded-[26px] px-3 py-4 text-[#c9c1b8] transition-[width] duration-200",
        open ? "w-[248px]" : "w-[72px]",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-3.5">
        <Link
          href={role === "admin" ? "/admin" : "/projects"}
          aria-label={t("home")}
          className="flex items-center gap-2.5 text-[#f5f2ee] no-underline"
        >
          <span
            aria-hidden="true"
            className="bg-accent text-on-accent inline-flex size-10 flex-none items-center justify-center rounded-xl"
          >
            <Icon name="logo" />
          </span>
          {open ? (
            <span className="font-display text-xl font-semibold tracking-[-0.02em]">Hindama</span>
          ) : null}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t("collapse") : t("expand")}
        className={cn(
          "mb-2 flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-[13px] text-[#c9c1b8]",
          open ? "self-stretch" : "self-center",
        )}
      >
        <Icon name={open ? "chevronLeft" : "chevronRight"} size={16} />
        {open ? <span>{t("collapse")}</span> : null}
      </button>

      {role === "admin" ? (
        <Group title={t("administration")} open={open}>
          {ADMIN_ITEMS.map((item) => (
            <NavItem
              key={item.key}
              href={item.href}
              icon={item.icon}
              label={t(item.key)}
              active={isActive(item.href, item.href === "/admin")}
              open={open}
            />
          ))}
        </Group>
      ) : (
        <>
          <Group open={open}>
            <NavItem
              href="/projects"
              icon="folder"
              label={t("projects")}
              active={pathname === "/projects" || pathname === "/projects/new"}
              open={open}
            />
          </Group>
          {project ? (
            <Group title={project.name} open={open}>
              {PROJECT_ITEMS.map((item) => {
                const href = `/projects/${project.id}${item.path}`;
                const note = project.notes?.[item.key];
                const locked = project.locked?.[item.key];
                return (
                  <NavItem
                    key={item.key}
                    href={href}
                    icon={item.icon}
                    label={t(`project.${item.key}`)}
                    active={
                      isActive(href, item.path === "") ||
                      (item.key === "history" &&
                        pathname.startsWith(`/projects/${project.id}/runs/`))
                    }
                    open={open}
                    note={locked ?? note?.text}
                    noteWarning={Boolean(locked) || note?.warning}
                    locked={Boolean(locked)}
                  />
                );
              })}
            </Group>
          ) : null}
        </>
      )}

      <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-3">
        <NavItem
          href="/profile"
          icon="user"
          label={t("profile")}
          active={isActive("/profile")}
          open={open}
        />
        <NavItem href="/sign-in" icon="logout" label={t("signOut")} active={false} open={open} />
      </div>
    </nav>
  );
}

function Group({
  title,
  open,
  children,
}: {
  title?: string;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 pb-2.5">
      {title && open ? (
        <span className="truncate px-3 pt-1.5 pb-0.5 text-xs text-[#8e867e]" title={title}>
          {title}
        </span>
      ) : null}
      {children}
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
  open,
  note,
  noteWarning,
  locked,
}: {
  href: string;
  icon: IconName;
  label: string;
  active: boolean;
  open: boolean;
  note?: string;
  noteWarning?: boolean;
  locked?: boolean;
}) {
  const className = cn(
    "flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] no-underline transition-colors duration-200",
    active
      ? "bg-accent text-on-accent font-semibold"
      : "font-medium text-[#c9c1b8] hover:bg-white/8",
    locked && "cursor-not-allowed opacity-60",
  );
  const content = (
    <>
      <Icon name={icon} size={20} strokeWidth={1.8} />
      {open && locked ? (
        // Bloqueado: el motivo va debajo del nombre para que no se corte.
        <span className="flex min-w-0 flex-1 flex-col py-1.5 leading-tight">
          <span className="whitespace-nowrap">{label}</span>
          {note ? <span className="text-xs text-[#ffb020]">{note}</span> : null}
        </span>
      ) : open ? (
        <>
          <span className="flex-1 whitespace-nowrap">{label}</span>
          {note ? (
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                active ? "text-on-accent" : noteWarning ? "text-[#ffb020]" : "text-[#8e867e]",
              )}
            >
              {note}
            </span>
          ) : null}
        </>
      ) : null}
    </>
  );

  if (locked) {
    // Bloqueado: se explica el motivo y no se puede abrir.
    return (
      <span aria-disabled="true" title={note ? `${label}: ${note}` : label} className={className}>
        {content}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={className}
    >
      {content}
    </Link>
  );
}
