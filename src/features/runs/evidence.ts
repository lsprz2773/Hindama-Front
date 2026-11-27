import type { Evidence } from "@/lib/api/schemas/findings";

const headerLines = (headers: Record<string, string>) =>
  Object.entries(headers).map(([name, value]) => `${name}: ${value}`);

/** Petición y respuesta como texto. Vienen de la API del analista: nunca se interpretan (C-12). */
export function evidenceText(evidence: Evidence) {
  const { request, response } = evidence;
  const req = [`${request.method} ${request.url}`, ...headerLines(request.headers)];
  if (request.body !== null) req.push("", request.body);
  const res = [`HTTP ${response.status_code}`, ...headerLines(response.headers), "", response.body];
  return { request: req.join("\n"), response: res.join("\n") };
}

/** Comando `curl` con la petición tal cual (las credenciales ya vienen enmascaradas, RN-11). */
export function curlFor(evidence: Evidence) {
  const quote = (value: string) => `'${value.replaceAll("'", `'\''`)}'`;
  const parts = [`curl -X ${evidence.request.method} ${quote(evidence.request.url)}`];
  for (const line of headerLines(evidence.request.headers)) parts.push(`-H ${quote(line)}`);
  if (evidence.request.body !== null) parts.push(`--data ${quote(evidence.request.body)}`);
  return parts.join(" \\n  ");
}

/** Claves de `Evidence.context` que el frontend sabe leer (contrato 0.10.0); las demás se ignoran. */
export type ContextNote =
  | { id: "undeclared"; names: string }
  | { id: "acceptedFields"; names: string }
  | { id: "createdResource"; status: "deleted" | "failed" }
  | { id: "requests"; count: number }
  | { id: "bodyBytes"; count: number }
  | { id: "operation"; value: string }
  | { id: "parameter"; value: string }
  | { id: "payload"; value: string };

const MAX_NAMES = 20;
const MAX_TEXT = 200;

const clip = (value: string) => (value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value);
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isNames = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string");

/**
 * Notas de los módulos de propiedades, consumo de recursos e inyección SQL. Los valores salen del
 * servidor evaluado (nombres de campos, ruta, carga de prueba): se devuelven como texto, nunca
 * como HTML (C-12), y recortados.
 */
export function contextNotes(context: Evidence["context"]): ContextNote[] {
  const notes: ContextNote[] = [];
  if (isNames(context.undeclared))
    notes.push({
      id: "undeclared",
      names: context.undeclared.slice(0, MAX_NAMES).map(clip).join(", "),
    });
  if (isNames(context.accepted_fields))
    notes.push({
      id: "acceptedFields",
      names: context.accepted_fields.slice(0, MAX_NAMES).map(clip).join(", "),
    });
  if (context.created_resource === "deleted" || context.created_resource === "failed")
    notes.push({ id: "createdResource", status: context.created_resource });
  if (typeof context.requests === "number") notes.push({ id: "requests", count: context.requests });
  if (typeof context.request_body_bytes === "number")
    notes.push({ id: "bodyBytes", count: context.request_body_bytes });
  if (isText(context.operation)) notes.push({ id: "operation", value: clip(context.operation) });
  if (isText(context.parameter)) notes.push({ id: "parameter", value: clip(context.parameter) });
  if (isText(context.payload)) notes.push({ id: "payload", value: clip(context.payload) });
  return notes;
}
