import { encryptSession } from "../../src/server/bff/session";
import { E2E_CSRF, E2E_SESSION_KEY } from "./env";

/** Access token de prueba: el simulador solo exige `Authorization: Bearer`; vence en 1 hora. */
function fakeAccessToken(): string {
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${enc({ alg: "none" })}.${enc({ exp, username: "e2e-user" })}.sig`;
}

/** Valor cifrado de `__Host-hindama_sesion`, igual que el que escribe el BFF al iniciar sesión. */
export function sessionCookieValue(): string {
  return encryptSession(
    {
      accessToken: fakeAccessToken(),
      refreshToken: "e2e-refresh",
      username: "e2e-user",
      csrf: E2E_CSRF,
    },
    Buffer.from(E2E_SESSION_KEY, "base64"),
  );
}
