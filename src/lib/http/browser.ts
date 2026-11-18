"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { createHttpClient, type HttpClient } from "./client";

/** Lee el token anti-CSRF de la cookie `XSRF-TOKEN` (patrón de doble envío). */
export function readCsrfToken(cookie: string = document.cookie): string | undefined {
  const match = cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Cliente HTTP para componentes de cliente. Se recrea al cambiar el idioma, así que
 * `Accept-Language` siempre sale del idioma activo.
 */
export function useHttpClient(): HttpClient {
  const locale = useLocale();

  return useMemo(
    () =>
      createHttpClient({
        getLocale: () => locale,
        getCsrfToken: () => readCsrfToken(),
      }),
    [locale],
  );
}
