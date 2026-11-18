/** Aviso no bloqueante que la API devuelve junto a una respuesta correcta (C-16). */
export interface ApiWarning {
  code: string;
  message?: string;
}

export type ApiErrorKind =
  | "unauthorized" // 401: sesión ausente o vencida
  | "forbidden" // 403: sin permiso (el frontend no decide permisos: RNF-08)
  | "not_found" // 404
  | "conflict" // 409
  | "validation" // 400 / 422
  | "server" // 5xx
  | "network" // sin respuesta
  | "unknown";

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

/** Error normalizado de cualquier llamada a la API. Nunca expone detalles internos al usuario. */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  /** Código estable de la API (`project.name_taken`…); sirve de clave de traducción. */
  readonly code?: string;
  /** Errores por campo, listos para mostrarse junto al campo. */
  readonly fields?: Record<string, string>;

  constructor(init: {
    status: number;
    kind?: ApiErrorKind;
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  }) {
    super(init.message ?? init.code ?? `HTTP ${init.status}`);
    this.name = "ApiError";
    this.status = init.status;
    this.kind = init.kind ?? kindFromStatus(init.status);
    this.code = init.code;
    this.fields = init.fields;
  }
}
