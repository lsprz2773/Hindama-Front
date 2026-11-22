"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { createHttpClient, type HttpClient } from "./client";

let csrfToken: Promise<string | undefined> | undefined;

/**
 * Token anti-CSRF sincronizado (ADR-005): vive dentro de la sesión cifrada, que el JavaScript
 * no puede leer, así que se pide al BFF una vez (`GET /api/auth/session`) y se guarda en memoria.
 */
export function readCsrfToken(fetchImpl: typeof fetch = fetch): Promise<string | undefined> {
  csrfToken ??= fetchImpl("/api/auth/session", { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) return undefined;
      const body = (await response.json()) as { csrf_token?: unknown };
      return typeof body.csrf_token === "string" ? body.csrf_token : undefined;
    })
    .catch(() => undefined)
    .then((token) => {
      if (!token) csrfToken = undefined;
      return token;
    });
  return csrfToken;
}

/** Al iniciar o cerrar sesión cambia el token: se guarda el nuevo o se olvida el anterior. */
export function setCsrfToken(token: string | undefined) {
  csrfToken = token ? Promise.resolve(token) : undefined;
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
