import { ApiError, type ApiWarning } from "./errors";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Query = Record<string, string | number | boolean | null | undefined>;

export interface HttpClientOptions {
  /** Prefijo común de las rutas. Por defecto, el BFF de Next (`/api`). */
  baseUrl?: string;
  /** Idioma activo de la interfaz; se envía en `Accept-Language` en cada petición. */
  getLocale: () => string;
  /** Token anti-CSRF (RNF-07); se envía en las peticiones que modifican datos. */
  getCsrfToken?: () => string | undefined | Promise<string | undefined>;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiResult<T> {
  data: T;
  warnings: ApiWarning[];
  status: number;
}

export const CSRF_HEADER = "X-CSRF-Token";

function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const url = `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** `Retry-After` en segundos o como fecha HTTP (RFC 9110). */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

/**
 * Lee un error en formato Problem Details (convenciones, sección 8): `code` y `request_id`
 * en la raíz, y `errors[]` con `field`, `code` y `message`. Se guarda el `code` de cada
 * error, no su `message`; los errores con `field: null` van a la lista general.
 */
export function toApiError(status: number, body: unknown, headers?: Headers): ApiError {
  const problem = asRecord(body);
  const fields: Record<string, string[]> = {};
  const general: string[] = [];

  if (Array.isArray(problem.errors)) {
    for (const item of problem.errors) {
      const entry = asRecord(item);
      const code = asString(entry.code);
      if (!code) continue;
      const field = asString(entry.field);
      if (field) (fields[field] ??= []).push(code);
      else general.push(code);
    }
  }

  const allow = headers?.get("Allow");
  return new ApiError({
    status,
    code: asString(problem.code),
    requestId: asString(problem.request_id) ?? headers?.get("X-Request-Id") ?? undefined,
    detail: asString(problem.detail),
    fields,
    general,
    retryAfter: status === 429 ? parseRetryAfter(headers?.get("Retry-After") ?? null) : undefined,
    allow:
      status === 405 && allow
        ? allow
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean)
        : undefined,
  });
}

/** Lee `warnings[]` de un recurso correcto (convenciones, sección 9). */
export function readWarnings(body: unknown): ApiWarning[] {
  const list = asRecord(body).warnings;
  if (!Array.isArray(list)) return [];
  const warnings: ApiWarning[] = [];
  for (const item of list) {
    const entry = asRecord(item);
    const code = asString(entry.code);
    if (!code) continue;
    warnings.push({
      code,
      message: asString(entry.message) ?? null,
      location: asString(entry.location) ?? null,
    });
  }
  return warnings;
}

/**
 * Cliente HTTP central. Toda llamada a la API pasa por aquí para que
 * `Accept-Language` siempre refleje el idioma activo y las peticiones que
 * modifican datos lleven el token anti-CSRF.
 */
export function createHttpClient(options: HttpClientOptions) {
  const baseUrl = options.baseUrl ?? "/api";
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function request<T>(
    method: Method,
    path: string,
    { query, body, headers, signal }: RequestOptions = {},
  ): Promise<ApiResult<T>> {
    const finalHeaders: Record<string, string> = {
      Accept: "application/json",
      "Accept-Language": options.getLocale(),
      ...headers,
    };
    if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
    if (method !== "GET") {
      const token = await options.getCsrfToken?.();
      if (token) finalHeaders[CSRF_HEADER] = token;
    }

    let response: Response;
    try {
      response = await doFetch(buildUrl(baseUrl, path, query), {
        method,
        headers: finalHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "same-origin",
        signal,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
      throw new ApiError({ status: 0, kind: "network" });
    }

    const parsed = await parseBody(response);
    if (!response.ok) throw toApiError(response.status, parsed, response.headers);

    // Un recurso viene sin sobre y una lista con `items` (convenciones, sección 6).
    return { data: parsed as T, warnings: readWarnings(parsed), status: response.status };
  }

  return {
    request,
    get: <T>(path: string, o?: RequestOptions) => request<T>("GET", path, o),
    post: <T>(path: string, o?: RequestOptions) => request<T>("POST", path, o),
    put: <T>(path: string, o?: RequestOptions) => request<T>("PUT", path, o),
    patch: <T>(path: string, o?: RequestOptions) => request<T>("PATCH", path, o),
    delete: <T>(path: string, o?: RequestOptions) => request<T>("DELETE", path, o),
  };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
