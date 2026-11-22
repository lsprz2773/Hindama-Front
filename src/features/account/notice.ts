"use client";

import { useSyncExternalStore } from "react";

/**
 * Aviso para la página de inicio (V-01) tras cerrar sesión. Vive en memoria, no en el
 * almacenamiento del navegador: solo hace falta durante la navegación que lleva al inicio.
 */
export type HomeNoticeKind = "local_sign_out";

let current: HomeNoticeKind | null = null;
const listeners = new Set<() => void>();

export function setHomeNotice(notice: HomeNoticeKind | null) {
  current = notice;
  listeners.forEach((listener) => listener());
}

export function useHomeNotice(): HomeNoticeKind | null {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => current,
    () => null,
  );
}
