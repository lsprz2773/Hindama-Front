import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Marco de una vista autenticada mientras la ruta carga (`loading.tsx`): barra lateral, cabecera
 * y el esqueleto del contenido. Mantiene las medidas del marco real para que no salte.
 */
export function AppShellSkeleton({
  children,
  withProject = false,
}: {
  children: ReactNode;
  withProject?: boolean;
}) {
  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="border-line bg-frame flex flex-wrap gap-5 rounded-[34px] border p-4 backdrop-blur-2xl">
        <div
          aria-hidden="true"
          className="bg-sidebar flex min-h-[820px] w-[248px] flex-none flex-col gap-3 rounded-[26px] px-3 py-4"
        >
          <Skeleton className="mb-3 h-10 w-32" />
          {Array.from({ length: withProject ? 9 : 3 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-[14px]" />
          ))}
        </div>
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5 px-3 pt-3 pb-6">
          <header aria-hidden="true" className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex flex-col gap-3">
              <Skeleton className="h-3.5 w-56" />
              <Skeleton className="h-10 w-72" />
            </span>
            <Skeleton className="h-12 w-40 rounded-full" />
          </header>
          <main id="main" className="flex flex-col gap-5">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
