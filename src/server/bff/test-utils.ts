import { randomBytes } from "node:crypto";
import type { BffConfig } from "./config";
import type { BffDeps } from "./deps";
import { encryptSession, type Session } from "./session";

export const ORIGIN = "https://hindama.test";

export const CONFIG: BffConfig = {
  cognitoRegion: "us-east-1",
  cognitoClientId: "client-id",
  cognitoClientSecret: "client-secret",
  apiUrl: "http://api.internal:8000",
  publicOrigin: ORIGIN,
};

export const KEY = randomBytes(32);

export function jwt(claims: Record<string, unknown>): string {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${enc({ alg: "none" })}.${enc(claims)}.sig`;
}

export const NOW = Date.parse("2026-11-22T08:00:00Z");
export const nowSeconds = Math.floor(NOW / 1000);

export function session(overrides: Partial<Session> = {}): Session {
  return {
    accessToken: jwt({ exp: nowSeconds + 15 * 60, username: "uuid-interno" }),
    refreshToken: "refresh-token",
    username: "uuid-interno",
    csrf: "csrf-token",
    ...overrides,
  };
}

export function sessionCookie(s: Session, key = KEY): string {
  return `__Host-hindama_sesion=${encodeURIComponent(encryptSession(s, key))}`;
}

export function deps(overrides: Partial<BffDeps> = {}): BffDeps {
  return {
    config: CONFIG,
    key: KEY,
    apiFetch: async () => new Response(null, { status: 204 }),
    cognitoFetch: async () => new Response("{}", { status: 200 }),
    now: () => NOW,
    ...overrides,
  };
}

export function cognitoTokens(accessToken: string, refreshToken?: string) {
  return new Response(
    JSON.stringify({
      AuthenticationResult: { AccessToken: accessToken, RefreshToken: refreshToken, IdToken: "id" },
    }),
    { status: 200 },
  );
}

export function cookiesFrom(response: Response): string[] {
  return response.headers.getSetCookie();
}
