"use client";

import { useEffect, useState } from "react";

/**
 * Si hay una sesión abierta y de qué rol, para las pantallas públicas (V-01, V-12, V-04, V-02).
 * Pregunta una vez a `GET /api/me` por el BFF: la cookie es `HttpOnly`, el navegador no la lee.
 * `unknown` mientras responde (y en el servidor); un fallo cuenta como sin sesión.
 */
export type SessionState =
  { status: "unknown" } | { status: "out" } | { status: "in"; role: "analyst" | "admin" };

export function useSessionState(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "unknown" });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/me", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        const body: unknown = response.ok ? await response.json() : null;
        const role = (body as { role?: unknown } | null)?.role;
        setState(
          role === "analyst" || role === "admin" ? { status: "in", role } : { status: "out" },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "out" });
      });
    return () => controller.abort();
  }, []);
  return state;
}
