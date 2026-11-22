import { CognitoError, refreshTokens } from "./cognito";
import { parseCookieHeader, SetCookieCollector } from "./cookies";
import { isAllowedOrigin, isUnsafeMethod, isValidCsrfToken } from "./csrf";
import type { BffDeps } from "./deps";
import { needsRefresh } from "./jwt";
import { problem, sanitizeProblem } from "./problem";
import { clientIp, newRequestId } from "./request-context";
import {
  clearSession,
  readSession,
  writeSession,
  type CookieReader,
  type Session,
} from "./session";

/** Las operaciones síncronas pueden tardar hasta 25 s; el BFF espera al menos 30 (convenciones §12). */
export const API_TIMEOUT_MS = 35_000;

/** Cabeceras de la respuesta de la API que llegan al navegador. */
const PASS_HEADERS = ["content-type", "retry-after", "allow", "x-request-id"];

export interface PreparedRequest {
  /** Cuerpo ya validado que se reenvía a la API (no el que mandó el navegador). */
  body?: BodyInit;
  contentType?: string;
  /** Consulta ya validada, con `?` o vacía. */
  search: string;
}

export interface ProxyOptions {
  /** Stream SSE (ADR-006): sin búfer, sin tiempo máximo y cerrado junto con el navegador. */
  stream?: boolean;
  /**
   * Valida la petición después de comprobar la sesión y el CSRF, y antes de llamar a la API.
   * Devuelve lo que se reenvía o una respuesta de error. Sin él, se reenvía el cuerpo y la
   * consulta tal cual (solo lo usa el relevo SSE, que no tiene cuerpo).
   */
  prepare?: (request: Request) => Promise<PreparedRequest | Response>;
  /**
   * Valida y limpia la respuesta correcta de la API antes de entregarla. Si no cumple el
   * contrato, el navegador recibe un error y nunca los datos.
   */
  transform?: (data: unknown) => { ok: true; data: unknown } | { ok: false };
}

/**
 * Reenvía una petición del navegador a la API de la plataforma (guía del frontend, sección 4):
 * comprueba `Origin` y `X-CSRF-Token` en los métodos que modifican datos, renueva el access
 * token si le quedan menos de 5 minutos, agrega `Authorization`, `X-Hindama-Client-IP`,
 * `X-Request-Id` y `Accept-Language`, reintenta una vez tras un 401 y traduce los errores a
 * Problem Details sin detalles internos. No decide permisos: un 403 de la API pasa tal cual
 * (RNF-08).
 */
export async function proxyToApi(
  request: Request,
  apiPath: string,
  deps: BffDeps,
  options: ProxyOptions = {},
): Promise<Response> {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const collector = new SetCookieCollector();
  const finish = (response: Response) => {
    collector.applyTo(response.headers);
    return response;
  };

  let session = readSession(cookies, deps.key);
  if (!session) {
    // Cookie ausente, alterada o cifrada con una llave rotada: se borra y se pide iniciar sesión.
    if (cookies.getAll().some((c) => c.name.startsWith("__Host-hindama_sesion"))) {
      clearSession(collector, cookies);
    }
    return finish(problem(401, "auth.required"));
  }

  if (isUnsafeMethod(request.method)) {
    if (
      !isAllowedOrigin(request.headers, deps.config.publicOrigin) ||
      !isValidCsrfToken(request.headers, session)
    ) {
      return finish(problem(403, "csrf.invalid"));
    }
  }

  let prepared: PreparedRequest;
  if (options.prepare) {
    const result = await options.prepare(request);
    if (result instanceof Response) return finish(result);
    prepared = result;
  } else {
    prepared = {
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      contentType: request.headers.get("content-type") ?? undefined,
      search: new URL(request.url).search,
    };
  }
  const requestId = newRequestId();

  try {
    if (needsRefresh(session.accessToken, deps.now())) {
      session = await renew(session, deps, collector, cookies);
    }

    let upstream = await send(request, apiPath, session, prepared, requestId, deps, options);
    if (upstream.status === 401) {
      await upstream.body?.cancel();
      session = await renew(session, deps, collector, cookies);
      upstream = await send(request, apiPath, session, prepared, requestId, deps, options);
      if (upstream.status === 401) {
        await upstream.body?.cancel();
        clearSession(collector, cookies);
        return finish(problem(401, "auth.invalid_token", { requestId }));
      }
    }
    return finish(await toBrowserResponse(upstream, requestId, deps, options));
  } catch (error) {
    if (error instanceof SessionExpired) {
      clearSession(collector, cookies);
      return finish(problem(401, "auth.invalid_token", { requestId }));
    }
    if (error instanceof DOMException && error.name === "AbortError" && request.signal.aborted) {
      return finish(new Response(null, { status: 499 }));
    }
    return finish(problem(503, "service.unavailable", { requestId }));
  }
}

class SessionExpired extends Error {}

/** Renueva con `REFRESH_TOKEN_AUTH` y guarda la sesión nueva en la cookie de la respuesta. */
async function renew(
  session: Session,
  deps: BffDeps,
  collector: SetCookieCollector,
  cookies: CookieReader,
): Promise<Session> {
  try {
    const tokens = await refreshTokens(
      deps.config,
      session.username,
      session.refreshToken,
      deps.cognitoFetch,
    );
    const next: Session = {
      ...session,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? session.refreshToken,
    };
    writeSession(collector, next, deps.key, cookies);
    return next;
  } catch (error) {
    if (error instanceof CognitoError && error.status < 500) throw new SessionExpired();
    throw error;
  }
}

function send(
  request: Request,
  apiPath: string,
  session: Session,
  prepared: PreparedRequest,
  requestId: string,
  deps: BffDeps,
  options: ProxyOptions,
): Promise<Response> {
  const { body, contentType } = prepared;
  // La base sale de la configuración del servidor; la ruta, del route handler (nunca del navegador).
  const url = `${deps.config.apiUrl}${apiPath}${prepared.search}`;
  const headers = new Headers({
    Authorization: `Bearer ${session.accessToken}`,
    "X-Request-Id": requestId,
    Accept: options.stream ? "text/event-stream" : "application/json",
  });
  const language = request.headers.get("accept-language");
  if (language) headers.set("Accept-Language", language);
  const ip = clientIp(request.headers);
  if (ip) headers.set("X-Hindama-Client-IP", ip);
  if (body !== undefined && contentType) headers.set("Content-Type", contentType);
  const lastEventId = request.headers.get("last-event-id");
  if (options.stream && lastEventId) headers.set("Last-Event-ID", lastEventId);

  return deps.apiFetch(url, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
    // El stream vive lo que la ejecución; se corta solo cuando el navegador cierra el suyo.
    signal: options.stream
      ? request.signal
      : AbortSignal.any([request.signal, AbortSignal.timeout(API_TIMEOUT_MS)]),
  });
}

async function toBrowserResponse(
  upstream: Response,
  requestId: string,
  deps: BffDeps,
  options: ProxyOptions,
): Promise<Response> {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("x-request-id")) headers.set("X-Request-Id", requestId);

  if (!upstream.ok && upstream.status !== 304) {
    const text = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const body = sanitizeProblem(upstream.status, parsed, requestId);
    headers.set("Content-Type", "application/problem+json");
    return new Response(JSON.stringify(body), { status: upstream.status, headers });
  }

  const location = upstream.headers.get("location");
  if (location) headers.set("Location", toBffLocation(location, deps.config.apiUrl));

  if (options.stream && upstream.headers.get("content-type")?.startsWith("text/event-stream")) {
    // Retransmisión sin búfer ni transformación (ADR-006).
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("X-Accel-Buffering", "no");
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  const empty = upstream.status === 204 || upstream.status === 304;
  if (empty) return new Response(null, { status: upstream.status, headers });
  if (options.transform) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await upstream.text());
    } catch {
      return problem(502, "response.invalid", { requestId });
    }
    const result = options.transform(parsed);
    if (!result.ok) return problem(502, "response.invalid", { requestId });
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(result.data), { status: upstream.status, headers });
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

/** `Location` de la API (`/projects/…`) → ruta equivalente del BFF (`/api/projects/…`). */
export function toBffLocation(location: string, apiUrl: string): string {
  const api = new URL(apiUrl);
  const url = new URL(location, `${apiUrl}/`);
  if (url.origin !== api.origin) return "/api";
  const base = api.pathname.replace(/\/$/, "");
  const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
  return `/api${path}${url.search}`;
}

/** Une segmentos de ruta escapados, para que un parámetro no pueda escapar de la ruta. */
export function apiPath(...segments: string[]): string {
  return segments.map((s) => `/${encodeURIComponent(s)}`).join("");
}
