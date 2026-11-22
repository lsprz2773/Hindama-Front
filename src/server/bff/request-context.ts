import { randomUUID } from "node:crypto";

/**
 * IP real del navegador para `X-Hindama-Client-IP` (RF-82). El frontend corre detrás de
 * Caddy, que agrega la IP del cliente al final de `X-Forwarded-For`; se toma esa última
 * entrada. Nunca se usa para autorizar.
 */
export function clientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").pop()?.trim();
    if (last) return last;
  }
  return headers.get("x-real-ip")?.trim() || undefined;
}

/** Cada petición hacia la API lleva un `X-Request-Id` nuevo, generado por el BFF. */
export function newRequestId(): string {
  return randomUUID();
}
