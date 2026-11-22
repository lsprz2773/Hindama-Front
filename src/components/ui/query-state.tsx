"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorPanel } from "@/features/errors/error-panel";
import { ApiError } from "@/lib/http";
import { Loadable } from "./loadable";
import { RateLimitedState, UnavailableState } from "./state-view";

interface QueryStateProps<T> {
  query: Pick<UseQueryResult<T>, "status" | "data" | "error" | "refetch">;
  skeleton: ReactNode;
  /** Qué se cargaba, para «No pudimos cargar {subject}». */
  subject: string;
  children: (data: T) => ReactNode;
}

/**
 * Carga, error y contenido de una consulta a la API (C-13). El frontend no decide permisos
 * (RNF-08): muestra lo que respondió la API. 403 y 404 con su página (V-12), 429 con la espera
 * de `Retry-After`, 503 con «intenta en unos minutos» y el resto (500, respuesta fuera del
 * contrato, red) con el `request_id` como referencia. Un 401 lo atiende el marco de la sesión.
 */
export function QueryState<T>({ query, skeleton, subject, children }: QueryStateProps<T>) {
  const retry = () => void query.refetch();
  const error = query.error instanceof ApiError ? query.error : undefined;

  if (query.status === "error" && error) {
    if (error.kind === "unauthorized") return <>{skeleton}</>;
    if (error.status === 403)
      return <ErrorPanel code={403} standalone={false} audience="analyst" />;
    if (error.status === 404) return <ErrorPanel code={404} standalone={false} />;
    if (error.status === 429) {
      return <RateLimitedState retryAfter={error.retryAfter ?? 30} onRetry={retry} />;
    }
    if (error.status === 503) return <UnavailableState onRetry={retry} />;
  }

  const status =
    query.status === "pending" ? "loading" : query.status === "error" ? "error" : "ready";
  return (
    <Loadable
      status={status}
      skeleton={skeleton}
      error={{ subject, reference: error?.requestId, onRetry: retry }}
    >
      {query.data !== undefined ? children(query.data) : null}
    </Loadable>
  );
}
