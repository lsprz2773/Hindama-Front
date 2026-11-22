"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Transición entre vistas: al cambiar de ruta el contenido entra con un fundido y un pequeño
 * ascenso. Solo se anima el contenido, no el marco (barra lateral y cabecera se quedan fijas).
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={cn("animate-page-in flex flex-col gap-5", className)}>
      {children}
    </div>
  );
}
