import type { ApiError } from "@/lib/http";
import type { ErrorCode } from "./error-panel";

const PANEL_CODES: readonly ErrorCode[] = [401, 403, 404, 429, 500, 503];

/**
 * Props de `ErrorPanel` (V-12) a partir de un error de la API. El `request_id` solo se
 * muestra en los 500 y 503 (guía del frontend, sección 4.2); el 429 usa `Retry-After`.
 * Devuelve `null` si el estado no tiene página de error (por ejemplo, un 422 va junto al campo).
 */
export function errorPanelProps(
  error: ApiError,
): { code: ErrorCode; reference?: string; retryAfter?: number } | null {
  const status = error.status >= 500 && error.status !== 503 ? 500 : error.status;
  if (!PANEL_CODES.includes(status as ErrorCode)) return null;
  const code = status as ErrorCode;
  return {
    code,
    reference: code === 500 || code === 503 ? error.requestId : undefined,
    retryAfter: code === 429 ? error.retryAfter : undefined,
  };
}
