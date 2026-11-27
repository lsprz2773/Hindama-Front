// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { handleSession, handleSignIn, handleSignOut } from "./auth";
import { secretHash, type FetchLike } from "./cognito";
import { parseCookieHeader } from "./cookies";
import { readSession } from "./session";
import {
  cognitoTokens,
  CONFIG,
  cookiesFrom,
  deps,
  jwt,
  KEY,
  nowSeconds,
  ORIGIN,
  session,
  sessionCookie,
} from "./test-utils";

function signInRequest(body: unknown, headers: Record<string, string> = { origin: ORIGIN }) {
  return new Request(`${ORIGIN}/api/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("inicio de sesión", () => {
  it("usa USER_PASSWORD_AUTH con SECRET_HASH del correo y guarda la sesión sin el id token", async () => {
    const access = jwt({ exp: nowSeconds + 900, username: "uuid-interno" });
    const cognitoFetch = vi.fn<FetchLike>(async () => cognitoTokens(access, "refresh-1"));

    const response = await handleSignIn(
      signInRequest({ email: "ana@ejemplo.mx", password: "Secreta#2026!" }),
      deps({ cognitoFetch }),
    );

    expect(response.status).toBe(200);
    const [, init] = cognitoFetch.mock.calls[0];
    expect(new Headers(init.headers).get("x-amz-target")).toBe(
      "AWSCognitoIdentityProviderService.InitiateAuth",
    );
    const sent = JSON.parse(String(init.body));
    expect(sent.AuthFlow).toBe("USER_PASSWORD_AUTH");
    expect(sent.AuthParameters.SECRET_HASH).toBe(
      secretHash("ana@ejemplo.mx", CONFIG.cognitoClientId, CONFIG.cognitoClientSecret),
    );
    expect(JSON.stringify(sent)).not.toContain(CONFIG.cognitoClientSecret);

    const { csrf_token } = await response.json();
    const cookie = cookiesFrom(response)[0];
    const stored = readSession(parseCookieHeader(cookie.split(";")[0]), KEY);
    expect(stored).toEqual({
      accessToken: access,
      refreshToken: "refresh-1",
      username: "uuid-interno",
      csrf: csrf_token,
    });
    expect(csrf_token).toHaveLength(43);
  });

  it("no revela si el correo existe (RF-06)", async () => {
    const results = [];
    for (const type of ["NotAuthorizedException", "UserNotFoundException"]) {
      const cognitoFetch = vi.fn<FetchLike>(
        async () => new Response(JSON.stringify({ __type: type }), { status: 400 }),
      );
      const response = await handleSignIn(
        signInRequest({ email: "a@b.co", password: "x" }),
        deps({ cognitoFetch }),
      );
      const body = await response.json();
      results.push([response.status, body.code]);
    }
    expect(results).toEqual([
      [401, "auth.invalid_credentials"],
      [401, "auth.invalid_credentials"],
    ]);
  });

  it("rechaza un Origin ajeno antes de llamar a Cognito", async () => {
    const cognitoFetch = vi.fn<FetchLike>();
    const response = await handleSignIn(
      signInRequest({ email: "a@b.co", password: "x" }, { origin: "https://evil.test" }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(403);
    expect(cognitoFetch).not.toHaveBeenCalled();
  });
});

describe("token anti-CSRF y cierre de sesión", () => {
  it("GET /api/auth/session entrega el token anti-CSRF y nunca los tokens de Cognito", async () => {
    const response = await handleSession(
      new Request(`${ORIGIN}/api/auth/session`, { headers: { cookie: sessionCookie(session()) } }),
      deps(),
    );
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ authenticated: true, csrf_token: "csrf-token" });
    expect(text).not.toContain("refresh-token");
    expect(text).not.toContain(session().accessToken);
  });

  it("cierra sesión con RevokeToken y después borra la cookie", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async () => new Response("{}", { status: 200 }));
    const response = await handleSignOut(
      new Request(`${ORIGIN}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie: sessionCookie(session()), origin: ORIGIN, "x-csrf-token": "csrf-token" },
      }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: true });
    const [, init] = cognitoFetch.mock.calls[0];
    expect(new Headers(init.headers).get("x-amz-target")).toBe(
      "AWSCognitoIdentityProviderService.RevokeToken",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      Token: "refresh-token",
      ClientId: CONFIG.cognitoClientId,
      ClientSecret: CONFIG.cognitoClientSecret,
    });
    expect(cookiesFrom(response)[0]).toMatch(/^__Host-hindama_sesion=;.*Max-Age=0/);
  });

  it("sin token anti-CSRF no cierra la sesión", async () => {
    const cognitoFetch = vi.fn<FetchLike>();
    const response = await handleSignOut(
      new Request(`${ORIGIN}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie: sessionCookie(session()), origin: ORIGIN },
      }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(403);
    expect(cognitoFetch).not.toHaveBeenCalled();
    expect(cookiesFrom(response)).toEqual([]);
  });

  it("si Cognito no responde, borra la cookie igual y avisa que fue un cierre local", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async () => new Response("{}", { status: 500 }));
    const response = await handleSignOut(
      new Request(`${ORIGIN}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie: sessionCookie(session()), origin: ORIGIN, "x-csrf-token": "csrf-token" },
      }),
      deps({ cognitoFetch }),
    );
    expect(await response.json()).toEqual({ revoked: false });
    expect(cookiesFrom(response)[0]).toMatch(/Max-Age=0/);
  });
});
