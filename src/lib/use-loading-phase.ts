"use client";

import { useEffect, useRef, useState } from "react";

/** Estado de una consulta: el que entrega la API (o la simulación) a la vista. */
export type LoadStatus = "loading" | "ready" | "error";

/**
 * Fase que se pinta:
 * - `pending`: cargando, pero aún no se muestra nada (evita el parpadeo en cargas rápidas);
 * - `skeleton`: se muestra el esqueleto;
 * - `content`: se muestra el contenido;
 * - `error`: se muestra el estado de error.
 */
export type LoadPhase = "pending" | "skeleton" | "content" | "error";

export interface LoadingPhaseOptions {
  /** Milisegundos de espera antes de mostrar el esqueleto. */
  delay?: number;
  /** Una vez visible, el esqueleto se queda al menos este tiempo (evita un destello). */
  minDuration?: number;
}

/**
 * Lógica común de los esqueletos de carga. Se conecta con cualquier fuente de datos: basta con
 * pasar su estado (`loading`, `ready` o `error`). TODO(api): lo alimenta la consulta real.
 *
 * Cada vez que la consulta vuelve a `loading` (filtros, reintento) empieza un «ciclo» nuevo:
 * espera `delay` antes de pintar el esqueleto y, si lo pintó, lo sostiene `minDuration`.
 */
export function useLoadingPhase(
  status: LoadStatus,
  { delay = 150, minDuration = 400 }: LoadingPhaseOptions = {},
): LoadPhase {
  const [previous, setPrevious] = useState(status);
  const [cycle, setCycle] = useState(status === "loading" ? 1 : 0);
  const [shownCycle, setShownCycle] = useState(0);
  const [releasedCycle, setReleasedCycle] = useState(0);
  const holdTimer = useRef<number | undefined>(undefined);

  // Un nuevo `loading` abre un ciclo (se ajusta durante el render, sin efectos).
  if (status !== previous) {
    setPrevious(status);
    if (status === "loading") setCycle((n) => n + 1);
  }

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => {
      setShownCycle(cycle);
      window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => setReleasedCycle(cycle), minDuration);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [status, cycle, delay, minDuration]);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const skeletonShown = shownCycle === cycle;
  if (status === "loading") return skeletonShown ? "skeleton" : "pending";
  if (skeletonShown && releasedCycle !== cycle) return "skeleton";
  return status === "error" ? "error" : "content";
}
