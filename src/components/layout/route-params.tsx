import { Suspense, type ReactNode } from "react";
import { AppShellSkeleton } from "@/components/skeletons/app-shell-skeleton";
import { DetailSkeleton } from "@/components/skeletons/page-skeletons";
import { resolveLocale } from "@/i18n/params";

/** Marco y esqueleto de una vista de proyecto mientras se resuelven los datos de la URL. */
function ProjectRouteFallback() {
  return (
    <AppShellSkeleton withProject>
      <DetailSkeleton />
    </AppShellSkeleton>
  );
}

async function ResolvedParams<P extends { locale: string }>({
  params,
  children,
}: {
  params: Promise<P>;
  children: (params: P) => ReactNode;
}) {
  const resolved = await params;
  await resolveLocale(params);
  return children(resolved);
}

/**
 * Lee los parámetros de la URL (`[id]`, `[runId]`…) dentro de un `<Suspense>`. Con Cache
 * Components, esperar `params` en el nivel de la página ata el marco estático a una sola URL y
 * Next avisa «URL data outside of Suspense»: aquí el marco (esqueleto) sale de inmediato y la
 * vista llega por streaming. También valida el idioma, como `resolveLocale`.
 *
 * @example
 * export default function Page({ params }: PageProps<"/[locale]/projects/[id]/history">) {
 *   return <RouteParams params={params}>{({ id }) => <HistoryView id={id} />}</RouteParams>;
 * }
 */
export function RouteParams<P extends { locale: string }>({
  params,
  fallback,
  children,
}: {
  params: Promise<P>;
  fallback?: ReactNode;
  children: (params: P) => ReactNode;
}) {
  return (
    <Suspense fallback={fallback ?? <ProjectRouteFallback />}>
      <ResolvedParams params={params}>{children}</ResolvedParams>
    </Suspense>
  );
}
