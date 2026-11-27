import type { CookieReader, CookieWriter } from "./session";

/** Lee la cabecera `Cookie` de la petición. */
export function parseCookieHeader(header: string | null): CookieReader {
  const cookies: { name: string; value: string }[] = [];
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // Valor con `%` suelto: se usa tal cual.
    }
    cookies.push({ name, value });
  }
  return { getAll: () => cookies };
}

/** Junta las cookies que el BFF quiere escribir y las agrega como `Set-Cookie`. */
export class SetCookieCollector implements CookieWriter {
  readonly values: string[] = [];

  set(
    name: string,
    value: string,
    options: { httpOnly: boolean; secure: boolean; sameSite: string; path: string; maxAge: number },
  ) {
    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      `Path=${options.path}`,
      `Max-Age=${options.maxAge}`,
    ];
    if (options.httpOnly) parts.push("HttpOnly");
    if (options.secure) parts.push("Secure");
    parts.push(`SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`);
    this.values.push(parts.join("; "));
  }

  applyTo(headers: Headers) {
    for (const value of this.values) headers.append("Set-Cookie", value);
  }
}
