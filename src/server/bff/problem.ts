import { randomUUID } from "node:crypto";

/**
 * Respuestas de error del BFF en el mismo formato Problem Details que la API (convenciones,
 * sección 8), para que el cliente HTTP lea todo igual. Nunca llevan trazas ni detalles
 * internos (RNF-07).
 */
export function problem(
  status: number,
  code: string,
  init: {
    requestId?: string;
    headers?: HeadersInit;
    detail?: string;
    errors?: { field: string | null; code: string; message: string }[];
  } = {},
): Response {
  const requestId = init.requestId ?? randomUUID();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/problem+json");
  headers.set("X-Request-Id", requestId);
  headers.set("Cache-Control", "no-store");
  return new Response(
    JSON.stringify({
      type: `urn:hindama:error:${code}`,
      title: code,
      status,
      detail: init.detail ?? "",
      code,
      request_id: requestId,
      errors: init.errors ?? [],
    }),
    { status, headers },
  );
}

interface FieldError {
  field: string | null;
  code: string;
  message: string;
}

/**
 * Deja pasar solo los campos de `Problem` del contrato (respuestas cerradas). Si el cuerpo
 * no es Problem Details (por ejemplo, una página HTML de un proxy), lo reemplaza por un
 * error genérico sin detalles.
 */
export function sanitizeProblem(status: number, body: unknown, requestId: string) {
  const source =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const fallbackCode =
    status >= 500 ? (status === 503 ? "service.unavailable" : "internal") : "request.error";
  if (!source || typeof source.code !== "string") {
    return {
      type: `urn:hindama:error:${fallbackCode}`,
      title: fallbackCode,
      status,
      detail: "",
      code: fallbackCode,
      request_id: requestId,
      errors: [] as FieldError[],
    };
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const errors: FieldError[] = Array.isArray(source.errors)
    ? source.errors.flatMap((item: unknown) => {
        if (!item || typeof item !== "object") return [];
        const e = item as Record<string, unknown>;
        if (typeof e.code !== "string") return [];
        return [
          {
            field: typeof e.field === "string" ? e.field : null,
            code: e.code,
            message: str(e.message),
          },
        ];
      })
    : [];
  return {
    type: str(source.type) || `urn:hindama:error:${source.code}`,
    title: str(source.title),
    status,
    detail: str(source.detail),
    code: source.code,
    request_id: str(source.request_id) || requestId,
    errors,
    // `VerificationProblem` (verifyOwnership, 422): resumen de lo obtenido, texto no confiable.
    ...(source.code.startsWith("verification.") && typeof source.found === "string"
      ? { found: source.found.slice(0, 200) }
      : {}),
  };
}
