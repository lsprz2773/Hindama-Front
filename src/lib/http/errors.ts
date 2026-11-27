/**
 * Aviso no bloqueante que la API devuelve dentro de un recurso correcto (C-16).
 * Contrato: esquema `Warning` (convenciones, sección 9).
 */
export interface ApiWarning {
  /** Código estable; el frontend elige el texto según este valor. */
  code: string;
  /** Texto en español de respaldo, solo para códigos que el frontend aún no conoce. */
  message: string | null;
  /** En avisos del contrato, JSON Pointer dentro del documento; si no, `null`. */
  location: string | null;
}

export type ApiErrorKind =
  | "unauthorized" // 401: sesión ausente o vencida
  | "forbidden" // 403: sin permiso (el frontend no decide permisos: RNF-08)
  | "not_found" // 404
  | "method_not_allowed" // 405: trae la cabecera `Allow`
  | "conflict" // 409
  | "too_large" // 413
  | "validation" // 400 / 422
  | "rate_limited" // 429: trae la cabecera `Retry-After`
  | "server" // 5xx
  | "network" // sin respuesta o tiempo agotado
  | "invalid_response" // la respuesta no cumple el contrato: no se muestra
  | "unknown";

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 405) return "method_not_allowed";
  if (status === 409) return "conflict";
  if (status === 413) return "too_large";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "unknown";
}

export interface ApiErrorInit {
  status: number;
  kind?: ApiErrorKind;
  code?: string;
  requestId?: string;
  detail?: string;
  fields?: Record<string, string[]>;
  general?: string[];
  retryAfter?: number;
  allow?: string[];
  found?: string;
}

/**
 * Error normalizado de cualquier llamada a la API, leído de Problem Details (RFC 9457,
 * convenciones sección 8). Nunca expone detalles internos al usuario.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  /** `code` de la raíz (`validation.failed`, `project.active_run`…): la clave del texto. */
  readonly code?: string;
  /** `request_id` de la raíz. Se muestra en los 500 y 503 para reportar el error. */
  readonly requestId?: string;
  /** `detail` en español: solo un respaldo para códigos que el frontend no conoce. */
  readonly detail?: string;
  /** Códigos de error por campo (`errors[].code`), en el orden en que llegaron. */
  readonly fields: Readonly<Record<string, readonly string[]>>;
  /** Códigos de `errors[]` cuyo `field` es `null`: no pertenecen a un campo. */
  readonly general: readonly string[];
  /** 429: segundos de espera indicados por `Retry-After`. */
  readonly retryAfter?: number;
  /** 405: métodos permitidos según la cabecera `Allow`. */
  readonly allow?: readonly string[];
  /** `VerificationProblem.found`: lo que obtuvo la verificación. Texto no confiable, solo escapado. */
  readonly found?: string;

  constructor(init: ApiErrorInit) {
    super(init.code ?? `HTTP ${init.status}`);
    this.name = "ApiError";
    this.status = init.status;
    this.kind = init.kind ?? kindFromStatus(init.status);
    this.code = init.code;
    this.requestId = init.requestId;
    this.detail = init.detail;
    this.fields = init.fields ?? {};
    this.general = init.general ?? [];
    this.retryAfter = init.retryAfter;
    this.allow = init.allow;
    this.found = init.found;
  }

  /** Primer código de error de un campo, o `undefined` si el campo no tiene errores. */
  fieldCode(field: string): string | undefined {
    return this.fields[field]?.[0];
  }
}
