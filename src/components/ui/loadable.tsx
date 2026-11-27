"use client";

import type { ReactNode } from "react";
import {
  useLoadingPhase,
  type LoadingPhaseOptions,
  type LoadStatus,
} from "@/lib/use-loading-phase";
import { LoadErrorState } from "./state-view";

interface LoadableProps extends LoadingPhaseOptions {
  /** Estado de la consulta que alimenta la vista. */
  status: LoadStatus;
  /** Esqueleto con la forma del contenido (ver `components/skeletons`). */
  skeleton: ReactNode;
  /** Qué se perdió, para «No pudimos cargar {subject}», y cómo reintentar. */
  error: { subject: string; reference?: string; onRetry: () => void };
  children: ReactNode;
}

/**
 * Contenedor de datos asíncronos: espera un instante antes de mostrar el esqueleto, lo sostiene
 * un mínimo para que no parpadee, hace un fundido al llegar el contenido y ofrece «Reintentar»
 * si falla. Es el punto de conexión con la API: basta con pasarle el estado de la consulta.
 *
 * @example
 * const { data, status, refetch } = useQuery(...); // TODO(api)
 * <Loadable status={status} skeleton={<ListPageSkeleton />} error={{ subject: "los proyectos", onRetry: refetch }}>
 *   <ProjectList data={data} />
 * </Loadable>
 */
export function Loadable({ status, skeleton, error, children, delay, minDuration }: LoadableProps) {
  const phase = useLoadingPhase(status, { delay, minDuration });
  if (phase === "pending") return null;
  if (phase === "skeleton") return <>{skeleton}</>;
  if (phase === "error") {
    return (
      <LoadErrorState subject={error.subject} reference={error.reference} onRetry={error.onRetry} />
    );
  }
  return <div className="animate-fade-in flex flex-col gap-5">{children}</div>;
}
