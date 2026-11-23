import { z } from "zod";
import { fieldErrors, hasControlChars, UUID_PATTERN } from "@/lib/api/zod";
import { getDeps, type BffDeps } from "./deps";
import { problem } from "./problem";
import { apiPath, proxyToApi, type PreparedRequest } from "./proxy";

/**
 * Route handlers del BFF declarados por contrato. Cada uno nombra una sola operación de la API
 * (método y ruta fijos); el navegador no elige ni la ruta ni el host (la base sale de
 * `HINDAMA_API_URL`). Antes de reenviar:
 *
 * 1. `proxyToApi` comprueba la sesión y, en los métodos que modifican datos, `Origin` y
 *    `X-CSRF-Token`.
 * 2. Se validan los parámetros de la URL (UUID acotados), la consulta (solo los parámetros que
 *    declara la operación, con sus límites) y el cuerpo (JSON de tamaño máximo y esquema
 *    `.strict()`). Lo que se reenvía es el resultado validado, no lo que mandó el navegador.
 * 3. La respuesta correcta se valida con el esquema del contrato y se entrega limpia; si no
 *    lo cumple, el navegador recibe `502 response.invalid`.
 */

/** Cuerpo máximo de una petición JSON (convenciones §12: 1 MB salvo la importación). */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;

type Segment = string | { param: string };

export interface ApiRouteSpec {
  /** Ruta de la API como segmentos; `{ param }` toma un parámetro validado de la URL. */
  path: readonly Segment[];
  /** Parámetros de consulta permitidos (objeto `.strict()`); sin él no se admite ninguno. */
  query?: z.ZodType<Record<string, unknown>>;
  /** Cuerpo JSON (`.strict()`); sin él, la petición no lleva cuerpo. */
  body?: z.ZodType;
  /** Esquema de la respuesta correcta (contrato). */
  response?: z.ZodType;
  maxBodyBytes?: number;
  /** La respuesta es un archivo de este tipo (no JSON): se releva con el tipo y nombre fijos. */
  download?: string;
  /** La operación cierra la cuenta (`deleteAccount`): al responder 204 se borra la cookie de sesión. */
  endsSession?: boolean;
  /**
   * Cuerpo `multipart/form-data` (solo `importContract`): valida el formulario recibido y
   * devuelve el que se reenvía, o los errores por campo.
   */
  multipart?: (form: FormData) => FormData | Record<string, string[]>;
}

type Params = Record<string, string | string[] | undefined>;

interface Context {
  params: Promise<Params>;
}

/** Lee la consulta con los parámetros repetidos como lista (convenciones §7). */
export function readQuery(url: URL): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

export function toSearch(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) params.append(key, String(item));
    }
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

function validationProblem(error: z.ZodError): Response {
  return fieldsProblem(fieldErrors(error));
}

/** Lee el cuerpo sin pasar del máximo, aunque `Content-Length` mienta. */
async function readLimitedBody(
  request: Request,
  maxBytes: number,
  type: RegExp,
): Promise<{ ok: true; value: Buffer } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, response: problem(413, "request.too_large") };
  if (!type.test(request.headers.get("content-type") ?? "")) {
    return { ok: false, response: problem(400, "request.malformed") };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, response: problem(400, "request.malformed") };
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false, response: problem(413, "request.too_large") };
    }
    chunks.push(value);
  }
  return { ok: true, value: Buffer.concat(chunks) };
}

/** Lee un cuerpo JSON sin pasar del máximo, aunque `Content-Length` mienta. */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const read = await readLimitedBody(request, maxBytes, /^application\/json(\s*;|$)/i);
  if (!read.ok) return read;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(read.value);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: problem(400, "request.malformed") };
  }
}

/** Lee un formulario `multipart/form-data` sin pasar del máximo. */
async function readFormBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: FormData } | { ok: false; response: Response }> {
  const type = request.headers.get("content-type") ?? "";
  const read = await readLimitedBody(request, maxBytes, /^multipart\/form-data\s*;\s*boundary=/i);
  if (!read.ok) return read;
  try {
    const form = await new Response(new Uint8Array(read.value), {
      headers: { "content-type": type },
    }).formData();
    return { ok: true, value: form };
  } catch {
    return { ok: false, response: problem(400, "request.malformed") };
  }
}

function fieldsProblem(fields: Record<string, string[]>): Response {
  const errors = Object.entries(fields).flatMap(([field, codes]) =>
    codes.map((code) => ({ field: field === "_" ? null : field, code, message: "" })),
  );
  return problem(422, "validation.failed", { errors });
}

/** Resuelve la ruta hacia la API con los parámetros de la URL ya validados. */
export function resolvePath(path: readonly Segment[], params: Params): string | null {
  const segments: string[] = [];
  for (const segment of path) {
    if (typeof segment === "string") {
      segments.push(segment);
      continue;
    }
    const value = params[segment.param];
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) return null;
    segments.push(value);
  }
  return apiPath(...segments);
}

/** Prepara la petición validada: consulta y cuerpo. */
export function prepareWith(spec: ApiRouteSpec) {
  return async (request: Request): Promise<PreparedRequest | Response> => {
    const url = new URL(request.url);
    const query = spec.query ?? z.strictObject({});
    const parsedQuery = query.safeParse(readQuery(url));
    if (!parsedQuery.success) return validationProblem(parsedQuery.error);

    if (spec.multipart) {
      const read = await readFormBody(request, spec.maxBodyBytes ?? MAX_JSON_BODY_BYTES);
      if (!read.ok) return read.response;
      const form = spec.multipart(read.value);
      if (!(form instanceof FormData)) return fieldsProblem(form);
      // Sin `contentType`: `fetch` pone el separador del formulario nuevo.
      return { body: form, search: toSearch(parsedQuery.data) };
    }
    if (!spec.body) {
      return { search: toSearch(parsedQuery.data) };
    }
    const read = await readJsonBody(request, spec.maxBodyBytes ?? MAX_JSON_BODY_BYTES);
    if (!read.ok) return read.response;
    const parsedBody = spec.body.safeParse(read.value);
    if (!parsedBody.success) return validationProblem(parsedBody.error);
    return {
      body: JSON.stringify(parsedBody.data),
      contentType: "application/json",
      search: toSearch(parsedQuery.data),
    };
  };
}

export function transformWith(schema: z.ZodType | undefined) {
  if (!schema) return undefined;
  return (data: unknown) => {
    const result = schema.safeParse(data);
    return result.success ? { ok: true as const, data: result.data } : { ok: false as const };
  };
}

/** Atiende una petición con una especificación de ruta (separado para probarlo sin Next). */
export async function handleApiRoute(
  spec: ApiRouteSpec,
  request: Request,
  params: Params,
  deps: BffDeps,
): Promise<Response> {
  const path = resolvePath(spec.path, params);
  // Un id con otra forma no puede existir: misma respuesta que un recurso ajeno (RN-02).
  if (!path) return problem(404, "resource.not_found");
  return proxyToApi(request, path, deps, {
    prepare: prepareWith(spec),
    transform: transformWith(spec.response),
    download: spec.download,
    endsSession: spec.endsSession,
  });
}

/** Route handler de Next para una operación del contrato. */
export function apiRoute(spec: ApiRouteSpec) {
  return async (request: Request, context: Context) =>
    handleApiRoute(spec, request, await context.params, await getDeps());
}

/**
 * Relevo SSE de `streamRunEvents` (V-26, ADR-006). Valida los ids como UUID, no admite consulta
 * y reenvía `Last-Event-ID` solo si cumple el contrato (hasta 64 caracteres sin control).
 */
export async function handleRunEvents(
  request: Request,
  params: Params,
  deps: BffDeps,
): Promise<Response> {
  const path = resolvePath(
    ["projects", { param: "projectId" }, "runs", { param: "runId" }, "events"],
    params,
  );
  if (!path) return problem(404, "resource.not_found");
  const lastEventId = request.headers.get("last-event-id");
  if (lastEventId !== null && (lastEventId.length > 64 || hasControlChars(lastEventId))) {
    return fieldsProblem({ "Last-Event-ID": ["validation.format"] });
  }
  return proxyToApi(request, path, deps, { stream: true, prepare: prepareWith({ path: [] }) });
}
