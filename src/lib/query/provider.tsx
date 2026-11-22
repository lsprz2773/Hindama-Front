"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/http";

export const ME_KEY = ["me"] as const;

/**
 * Caché de datos de la API (TanStack Query). Los reintentos los hace el cliente HTTP (solo
 * `GET`, con espera creciente y `Retry-After`), así que aquí van apagados para no duplicarlos.
 * Un 401 en cualquier consulta vuelve a pedir `/me`: si la sesión ya no existe, el marco de la
 * app lleva a iniciar sesión (guía del frontend §4.2).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const onUnauthorized = (error: unknown, isMe = false) => {
      if (!isMe && error instanceof ApiError && error.kind === "unauthorized") {
        void queryClient.invalidateQueries({ queryKey: ME_KEY });
      }
    };
    const queryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => onUnauthorized(error, query.queryKey[0] === ME_KEY[0]),
      }),
      mutationCache: new MutationCache({ onError: (error) => onUnauthorized(error) }),
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 },
        mutations: { retry: false },
      },
    });
    return queryClient;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
