import { timingSafeEqual } from "node:crypto";
import type { Session } from "./session";

/** Métodos que modifican datos: exigen `Origin` correcto y `X-CSRF-Token` (RNF-07, ADR-005). */
export const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const CSRF_HEADER = "x-csrf-token";

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

/** El `Origin` debe ser exactamente el origen público del frontend. Sin `Origin` se rechaza. */
export function isAllowedOrigin(headers: Headers, publicOrigin: string): boolean {
  const origin = headers.get("origin");
  return origin !== null && origin === publicOrigin;
}

/** Compara el token enviado con el de la sesión cifrada, en tiempo constante. */
export function isValidCsrfToken(headers: Headers, session: Session): boolean {
  const sent = headers.get(CSRF_HEADER);
  if (!sent) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(session.csrf);
  return a.length === b.length && timingSafeEqual(a, b);
}
