import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Sesión del BFF (ADR-005, guía del frontend sección 3): cookie `__Host-hindama_sesion`
 * cifrada con AES-256-GCM. Contiene solo el access token, el refresh token, el `username`
 * interno de Cognito y el token anti-CSRF sincronizado. El id token no se guarda.
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
  /** `username` interno de Cognito (claim `username`), no el correo: lo exige `REFRESH_TOKEN_AUTH`. */
  username: string;
  /** Token anti-CSRF sincronizado (RNF-07). */
  csrf: string;
}

export const SESSION_COOKIE = "__Host-hindama_sesion";
/** Tamaño máximo del valor de cada cookie; por encima se divide en `.0`, `.1`… */
export const CHUNK_SIZE = 3800;
/** Vida de la cookie: la del refresh token (7 días, guía del frontend sección 2.2). */
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
} as const;

const VERSION = "v1";
const AAD = Buffer.from(`hindama_sesion:${VERSION}`);

export function newCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function encryptSession(session: Session, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const payload = JSON.stringify({
    a: session.accessToken,
    r: session.refreshToken,
    u: session.username,
    c: session.csrf,
  });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${Buffer.concat([iv, encrypted, tag]).toString("base64url")}`;
}

/** Descifra la cookie. Devuelve `null` si está alterada, es de otra llave o no es válida. */
export function decryptSession(value: string, key: Buffer): Session | null {
  const [version, data] = value.split(".");
  if (version !== VERSION || !data) return null;
  try {
    const raw = Buffer.from(data, "base64url");
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAAD(AAD);
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const json = Buffer.concat([
      decipher.update(raw.subarray(12, raw.length - 16)),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const { a, r, u, c } = parsed;
    if (![a, r, u, c].every((v) => typeof v === "string" && v)) return null;
    return {
      accessToken: a as string,
      refreshToken: r as string,
      username: u as string,
      csrf: c as string,
    };
  } catch {
    return null;
  }
}

export interface CookieReader {
  getAll(): { name: string; value: string }[];
}

export interface CookieWriter {
  set(
    name: string,
    value: string,
    options: typeof SESSION_COOKIE_OPTIONS & { maxAge: number },
  ): unknown;
}

function isSessionCookie(name: string): boolean {
  return name === SESSION_COOKIE || /^__Host-hindama_sesion\.\d+$/.test(name);
}

/** Une el valor completo: la cookie única o sus fragmentos `.0`, `.1`… en orden. */
export function joinSessionCookie(cookies: CookieReader): string | null {
  const all = cookies.getAll().filter((c) => isSessionCookie(c.name));
  const single = all.find((c) => c.name === SESSION_COOKIE);
  if (single) return single.value;
  const chunks = new Map(all.map((c) => [Number(c.name.split(".").pop()), c.value]));
  if (!chunks.has(0)) return null;
  let value = "";
  for (let i = 0; chunks.has(i); i += 1) value += chunks.get(i);
  return value;
}

export function readSession(cookies: CookieReader, key: Buffer): Session | null {
  const value = joinSessionCookie(cookies);
  return value ? decryptSession(value, key) : null;
}

/**
 * Escribe la sesión en una cookie o en fragmentos si supera `CHUNK_SIZE`, y borra las
 * cookies de sesión que ya no se usan (`existing`).
 */
export function writeSession(
  writer: CookieWriter,
  session: Session,
  key: Buffer,
  existing: CookieReader,
): void {
  const value = encryptSession(session, key);
  const names = new Set<string>();
  const options = { ...SESSION_COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE };
  if (value.length <= CHUNK_SIZE) {
    writer.set(SESSION_COOKIE, value, options);
    names.add(SESSION_COOKIE);
  } else {
    for (let i = 0; i * CHUNK_SIZE < value.length; i += 1) {
      const name = `${SESSION_COOKIE}.${i}`;
      writer.set(name, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), options);
      names.add(name);
    }
  }
  for (const { name } of existing.getAll()) {
    if (isSessionCookie(name) && !names.has(name)) {
      writer.set(name, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    }
  }
}

/** Borra la cookie de sesión y todos sus fragmentos. */
export function clearSession(writer: CookieWriter, existing: CookieReader): void {
  const names = new Set([SESSION_COOKIE]);
  for (const { name } of existing.getAll()) if (isSessionCookie(name)) names.add(name);
  for (const name of names) writer.set(name, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
}
