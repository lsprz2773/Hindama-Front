"use client";

import { useSyncExternalStore } from "react";

/**
 * Correo en proceso de verificación o recuperación. Se guarda en sessionStorage
 * (no en la URL) para llevarlo entre pantallas sin exponerlo en el historial.
 */
const KEY = "hindama.pendingEmail";

export function setPendingEmail(email: string) {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    // Sin almacenamiento disponible: la pantalla siguiente pedirá el correo de nuevo.
  }
}

function read(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

const subscribe = () => () => {};

/** Devuelve el correo pendiente; vacío en el servidor y mientras no exista. */
export function usePendingEmail(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}
