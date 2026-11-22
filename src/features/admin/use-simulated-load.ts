"use client";

import { useEffect, useState } from "react";
import { readFlag } from "@/features/account/browser-store";

/** Con esta marca en sessionStorage la consulta simulada falla, para ver el estado de error. */
export const SIMULATE_ERROR_KEY = "hindama.simulate.error";

export type LoadStatus = "loading" | "ready" | "error";

/**
 * Simula la carga de una consulta que depende de `key` (periodo, filtros…).
 * TODO(api): se sustituye por la consulta real; conserva los tres estados de la vista.
 */
export function useSimulatedLoad(key: string, delay = 250) {
  const [state, setState] = useState<{ key: string; status: LoadStatus; attempt: number }>({
    key: "",
    status: "loading",
    attempt: 0,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState({
        key,
        attempt,
        status: readFlag(SIMULATE_ERROR_KEY) ? "error" : "ready",
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [key, attempt, delay]);

  // Mientras la clave o el intento actuales no se hayan resuelto, la consulta sigue cargando.
  const status: LoadStatus =
    state.key === key && state.attempt === attempt ? state.status : "loading";
  return { status, retry: () => setAttempt((n) => n + 1) };
}
