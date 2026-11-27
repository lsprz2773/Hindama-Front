export type BaseUrlProblem =
  "invalid" | "protocol" | "private" | "loopback" | "linkLocal" | "metadata";

export type BaseUrlCheck =
  | { ok: true; url: URL; insecure: boolean; hostname: string }
  | { ok: false; problem: BaseUrlProblem };

function ipv4(hostname: string): number[] | null {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every((p) => p <= 255) ? parts : null;
}

/**
 * Valida la URL base de un proyecto en el navegador. Es solo una ayuda: la API repite la
 * validación y es la que decide (SSRF). No se aceptan redes privadas, loopback, enlace local
 * ni los metadatos de la nube.
 */
export function checkBaseUrl(value: string): BaseUrlCheck {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, problem: "invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, problem: "protocol" };
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]") {
    return { ok: false, problem: "loopback" };
  }
  const ip = ipv4(hostname);
  if (ip) {
    const [a, b] = ip;
    if (a === 169 && b === 254 && ip[2] === 169 && ip[3] === 254) {
      return { ok: false, problem: "metadata" };
    }
    if (a === 127) return { ok: false, problem: "loopback" };
    if (a === 169 && b === 254) return { ok: false, problem: "linkLocal" };
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return { ok: false, problem: "private" };
    }
  }
  return { ok: true, url, insecure: url.protocol === "http:", hostname };
}
