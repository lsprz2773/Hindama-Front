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

function toApiError(status: number, body: unknown): ApiError {
  const source = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const nested = (
    source.error && typeof source.error === "object" ? source.error : source
  ) as Record<string, unknown>;
  const fields = nested.fields && typeof nested.fields === "object" ? nested.fields : undefined;
  return new ApiError({
    status,
    code: typeof nested.code === "string" ? nested.code : undefined,
    message: typeof nested.message === "string" ? nested.message : undefined,
    fields: fields as Record<string, string> | undefined,
  });
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
    if (!response.ok) throw toApiError(response.status, parsed);

    const envelope = (parsed && typeof parsed === "object" ? parsed : {}) as {
      data?: T;
      warnings?: ApiWarning[];
    };
    return {
      data: ("data" in envelope ? envelope.data : parsed) as T,
      warnings: Array.isArray(envelope.warnings) ? envelope.warnings : [],
      status: response.status,
    };
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
