"use client";

import { useSyncExternalStore } from "react";

/** Utilidades de navegador sin API: hoy solo `useIsClient`. */

const noopSubscribe = () => () => {};

/** `true` solo en el navegador, ya hidratado; sirve para no redirigir con el estado del servidor. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
