import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SESSION_COOKIE_OPTIONS, type CookieReader, type CookieWriter } from "./session";

/**
 * Desafío de segundo factor pendiente (ADR-018). Entre el correo y contraseña y el código TOTP,
 * el BFF guarda en una cookie cifrada (`__Host-hindama_mfa`, AES-256-GCM con la misma llave de la
 * sesión) lo que Cognito pide para completar el inicio de sesión: la `Session` del desafío, el
 * correo y el `username` interno. Dura lo que la `Session` de Cognito (3 minutos), nunca lleva
 * tokens y se borra al terminar o al fallar.
 */
export const MFA_COOKIE = "__Host-hindama_mfa";
export const MFA_MAX_AGE = 3 * 60;

const VERSION = "v1";
const AAD = Buffer.from(`hindama_mfa:${VERSION}`);

export interface MfaChallenge {
  email: string;
  username?: string;
  session: string;
}

export function encryptChallenge(challenge: MfaChallenge, key: Buffer, now: number): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const payload = JSON.stringify({
    e: challenge.email,
    u: challenge.username,
    s: challenge.session,
    x: Math.floor(now / 1000) + MFA_MAX_AGE,
  });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64url")}`;
}

/** Descifra el desafío. `null` si está alterado, vencido, es de otra llave o no es válido. */
export function decryptChallenge(value: string, key: Buffer, now: number): MfaChallenge | null {
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
    const { e, u, s, x } = JSON.parse(json) as Record<string, unknown>;
    if (typeof e !== "string" || typeof s !== "string" || typeof x !== "number") return null;
    if (x < Math.floor(now / 1000)) return null;
    return { email: e, username: typeof u === "string" ? u : undefined, session: s };
  } catch {
    return null;
  }
}

export function readChallenge(cookies: CookieReader, key: Buffer, now: number) {
  const cookie = cookies.getAll().find((c) => c.name === MFA_COOKIE);
  return cookie ? decryptChallenge(cookie.value, key, now) : null;
}

export function writeChallenge(
  writer: CookieWriter,
  challenge: MfaChallenge,
  key: Buffer,
  now: number,
) {
  writer.set(MFA_COOKIE, encryptChallenge(challenge, key, now), {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: MFA_MAX_AGE,
  });
}

export function clearChallenge(writer: CookieWriter) {
  writer.set(MFA_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
}
