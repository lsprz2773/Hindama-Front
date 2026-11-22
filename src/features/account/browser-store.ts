"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado de navegador que sustituye a la API mientras no exista: sessionStorage por clave,
 * con suscripción para que las pantallas se actualicen al cambiarlo.
 */
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function readFlag(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeFlag(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: el estado simulado no persiste entre pantallas.
  }
  notify();
}

export function useFlag(key: string): string | null {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => readFlag(key),
    () => null,
  );
}

/** Rol de la sesión simulada: `analyst` o `admin`. Sin sesión iniciada en esta pestaña no se restringe nada. */
export const TWO_FACTOR_KEY = "hindama.twoFactor";

const noopSubscribe = () => () => {};

/** `true` solo en el navegador, ya hidratado; sirve para no redirigir con el estado del servidor. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
