"use client";

import { useSyncExternalStore } from "react";

/**
 * Correo en proceso de verificación. Vive solo en memoria (no en la URL ni en el almacenamiento
 * del navegador, que no deben guardar datos personales): sobrevive a la navegación dentro de la
 * app y se pierde al recargar, en cuyo caso la pantalla pide el correo otra vez.
 */
let pending = "";
const listeners = new Set<() => void>();

export function setPendingEmail(email: string) {
  pending = email;
  listeners.forEach((listener) => listener());
}

export function usePendingEmail(): string {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => pending,
    () => "",
  );
}
