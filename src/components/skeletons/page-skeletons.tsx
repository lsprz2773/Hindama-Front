import {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonRegion,
  SkeletonRows,
  SkeletonStat,
  SkeletonText,
} from "@/components/ui/skeleton";

/**
 * Esqueletos de contenido por tipo de vista. Imitan el marco y las proporciones de las reales:
 * se usan dentro del marco ya pintado (`Loadable`) o en los `loading.tsx` de cada ruta.
 * TODO(api): al conectar la API, cada vista elige el suyo y se lo pasa a `Loadable`.
 */

/** Lista de tarjetas (p. ej. proyectos): resumen y rejilla. */
export function ListPageSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonRegion label={label} className="flex flex-col gap-5">
      <SkeletonCard className="flex-row flex-wrap gap-8 bg-[image:var(--hero)]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="flex flex-col gap-2">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-3 w-24" />
          </span>
        ))}
      </SkeletonCard>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-5 w-3/5" />
            <SkeletonText lines={2} />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </SkeletonCard>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Panel de un proyecto: héroe, tarjetas laterales y módulos. */
export function DashboardSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonRegion label={label} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-5">
        <SkeletonCard className="min-w-0 flex-[999_1_560px] gap-5 bg-[image:var(--hero)] p-8">
          <Skeleton className="h-7 w-48 rounded-full" />
          <Skeleton className="h-12 w-3/5" />
          <SkeletonText lines={2} />
          <Skeleton className="h-[54px] w-44 rounded-2xl" />
        </SkeletonCard>
        <div className="flex min-w-[280px] flex-[1_1_300px] flex-col gap-5">
          <SkeletonCard>
            <Skeleton className="h-5 w-2/5" />
            <SkeletonText lines={4} />
          </SkeletonCard>
          <SkeletonCard>
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-9 w-20" />
          </SkeletonCard>
        </div>
      </div>
      <SkeletonCard>
        <Skeleton className="h-5 w-40" />
        <SkeletonRows rows={4} />
      </SkeletonCard>
    </SkeletonRegion>
  );
}

/** Tabla con filtros (hallazgos, historial, bitácora). */
export function TablePageSkeleton({ label, rows = 6 }: { label?: string; rows?: number }) {
  return (
    <SkeletonRegion label={label} className="flex flex-col gap-5">
      <SkeletonCard>
        <Skeleton className="h-5 w-24" />
        <div className="flex flex-wrap gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[52px] min-w-[170px] flex-1 rounded-2xl" />
          ))}
        </div>
      </SkeletonCard>
      <SkeletonCard>
        <Skeleton className="h-5 w-48" />
        <SkeletonRows rows={rows} />
      </SkeletonCard>
    </SkeletonRegion>
  );
}

/** Detalle de un elemento (hallazgo, ejecución): resumen, dos cuadros y evidencia. */
export function DetailSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonRegion label={label} className="flex flex-col gap-5">
      <SkeletonCard className="gap-5 bg-[image:var(--hero)] p-8">
        <Skeleton className="h-6 w-56 rounded-full" />
        <div className="flex flex-wrap gap-8">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-28" />
            </span>
          ))}
        </div>
        <Skeleton className="h-[54px] w-40 rounded-2xl" />
      </SkeletonCard>
      <div className="flex flex-wrap gap-5">
        <SkeletonCard className="min-w-[280px] flex-1">
          <Skeleton className="h-4 w-2/3" />
          <SkeletonText lines={2} />
        </SkeletonCard>
        <SkeletonCard className="min-w-[280px] flex-1">
          <Skeleton className="h-4 w-1/2" />
          <SkeletonText lines={2} />
        </SkeletonCard>
      </div>
      <SkeletonCard>
        <Skeleton className="h-5 w-52" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
          <Skeleton className="h-40 rounded-[20px]" />
          <Skeleton className="h-40 rounded-[20px]" />
        </div>
      </SkeletonCard>
    </SkeletonRegion>
  );
}

/** Formulario: campos apilados y botón. */
export function FormSkeleton({ label, fields = 4 }: { label?: string; fields?: number }) {
  return (
    <SkeletonRegion label={label} className="flex max-w-[860px] flex-col gap-5">
      <SkeletonCard className="gap-5">
        {Array.from({ length: fields }, (_, i) => (
          <span key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-[52px] w-full rounded-2xl" />
          </span>
        ))}
        <Skeleton className="h-[50px] w-36 self-end rounded-2xl" />
      </SkeletonCard>
    </SkeletonRegion>
  );
}

/** Estadísticas: indicadores, gráfica y listas de barras. */
export function StatsSkeleton({ label }: { label?: string }) {
  return (
    <SkeletonRegion label={label} className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
      <SkeletonCard>
        <Skeleton className="h-5 w-48" />
        <SkeletonChart />
      </SkeletonCard>
      <div className="flex flex-wrap gap-5">
        {[0, 1].map((i) => (
          <SkeletonCard key={i} className="min-w-[300px] flex-1">
            <Skeleton className="h-5 w-3/5" />
            <SkeletonText lines={5} />
          </SkeletonCard>
        ))}
      </div>
    </SkeletonRegion>
  );
}
