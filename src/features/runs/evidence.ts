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
