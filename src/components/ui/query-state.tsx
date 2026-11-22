"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorPanel } from "@/features/errors/error-panel";
import { errorPanelProps } from "@/features/errors/from-api-error";
import { ApiError } from "@/lib/http";
import { Loadable } from "./loadable";

interface QueryStateProps<T> {
  query: Pick<UseQueryResult<T>, "status" | "data" | "error" | "refetch">;
  skeleton: ReactNode;
  /** Qué se cargaba, para «No pudimos cargar {subject}». */
  subject: string;
  children: (data: T) => ReactNode;
}

/**
 * Carga, error y contenido de una consulta a la API (C-13 y V-12). El frontend no decide
 * permisos (RNF-08): muestra lo que respondió la API. 403, 404, 429 (con la espera de
 * `Retry-After`), 500 y 503 (con el `request_id` para reportarlo) usan las páginas de error de
 * V-12 dentro del marco. Una respuesta fuera del contrato o un fallo de red se tratan como 500.
 * Un 401 lo atiende el marco de la sesión, que lleva a iniciar sesión.
 */
export function QueryState<T>({ query, skeleton, subject, children }: QueryStateProps<T>) {
  const retry = () => void query.refetch();
  const error = query.error instanceof ApiError ? query.error : undefined;

  if (query.status === "error" && error) {
    if (error.kind === "unauthorized") return <>{skeleton}</>;
    const panel = errorPanelProps(error);
    if (panel) return <ErrorPanel {...panel} onRetry={retry} standalone={false} />;
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
