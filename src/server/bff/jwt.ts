/**
 * Lee los claims de un JWT **sin verificarlo**. Solo sirve para saber cuándo vence el access
 * token y su `username`; quien verifica la firma es FastAPI (guía del frontend, sección 2.4).
 * Nunca se usa para decidir permisos (RNF-08).
 */
export function decodeClaims(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Segundos hasta que vence el token; `0` si no trae `exp` o ya venció. */
export function secondsUntilExpiry(token: string, now = Date.now()): number {
  const exp = decodeClaims(token)?.exp;
  if (typeof exp !== "number") return 0;
  return Math.max(0, exp - Math.floor(now / 1000));
}

/** ADR-005: renovar cuando al access token le quedan menos de 5 minutos. */
export const REFRESH_THRESHOLD_SECONDS = 5 * 60;

export function needsRefresh(token: string, now = Date.now()): boolean {
  return secondsUntilExpiry(token, now) < REFRESH_THRESHOLD_SECONDS;
}
