"use client";

import { useEffect } from "react";

/**
 * Marca `<html data-hydrated>` cuando React ya tomó el control de la página.
 * Las pruebas e2e esperan esta marca antes de interactuar, para no hacer clic en un botón
 * que todavía no tiene su comportamiento.
 */
export function HydrationFlag() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
