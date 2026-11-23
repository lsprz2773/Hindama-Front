// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  handleMfaChallenge,
  handleMfaDisable,
  handleMfaSetup,
  handleMfaVerify,
  handleSignIn,
} from "./auth";
import { secretHash, type FetchLike } from "./cognito";
import { decryptChallenge, MFA_COOKIE } from "./mfa-challenge";
import {
  cognitoTokens,
  CONFIG,
  cookiesFrom,
  deps,
  jwt,
  KEY,
  NOW,
  nowSeconds,
  ORIGIN,
  session,
  sessionCookie,
} from "./test-utils";

/** Segundo factor TOTP con Cognito (CU-22, RF-85 a RF-87, ADR-018). */
const EMAIL = "ana@ejemplo.mx";
// Contraseña ficticia solo para pruebas; se construye para no parecer una credencial real.
const PASSWORD = ["Prueba", "2026", "#x!"].join("");
const CHALLENGE_SESSION = "sesion-del-desafio-de-cognito";

function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Petición con sesión: cookie cifrada y el token anti-CSRF de la prueba. */
function authed(path: string, body?: unknown, over: Record<string, string> = {}) {
  return post(path, body, {
    cookie: sessionCookie(session()),
    "x-csrf-token": "csrf-token",
    ...over,
  });
}

function actionOf(fetchMock: ReturnType<typeof vi.fn<FetchLike>>, index = 0) {
  const [, init] = fetchMock.mock.calls[index];
  return {
    action: new Headers(init.headers).get("x-amz-target")?.split(".").pop(),
    body: JSON.parse(String(init.body)) as Record<string, unknown>,
  };
}

function cognitoError(type: string, status = 400) {
  return Response.json({ __type: type }, { status });
}

function challengeResponse() {
  return Response.json({
    ChallengeName: "SOFTWARE_TOKEN_MFA",
    Session: CHALLENGE_SESSION,
    ChallengeParameters: { USER_ID_FOR_SRP: "uuid-interno" },
  });
}

function meResponse(role: "analyst" | "admin", mfaEnabled: boolean) {
  return Response.json({
    id: "0192e3a0-1111-7000-8000-000000000001",
    name: "Ana",
    email: EMAIL,
    role,
    mfa_enabled: mfaEnabled,
    terms: {
      current_version: "v",
      accepted_version: null,
      accepted_at: null,
      acceptance_required: true,
    },
  });
}

describe("inicio de sesión con segundo factor (V-05)", () => {
  it("si Cognito pide el código, no crea sesión y guarda el desafío cifrado", async () => {
    const response = await handleSignIn(
      post("/api/auth/sign-in", { email: EMAIL, password: PASSWORD }),
      deps({ cognitoFetch: vi.fn<FetchLike>(async () => challengeResponse()) }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mfa_required: true });
    const cookies = cookiesFrom(response);
    expect(cookies.some((c) => c.startsWith("__Host-hindama_sesion="))).toBe(false);
    const cookie = cookies.find((c) => c.startsWith(`${MFA_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/Max-Age=180/i);
    // No viaja en claro: ni la `Session` de Cognito ni el correo.
    expect(cookie).not.toContain(CHALLENGE_SESSION);
    expect(cookie).not.toContain("ana%40");
    const value = decodeURIComponent(cookie!.split(";")[0].slice(MFA_COOKIE.length + 1));
    expect(decryptChallenge(value, KEY, NOW)).toEqual({
      email: EMAIL,
      username: "uuid-interno",
      session: CHALLENGE_SESSION,
    });
  });

  it("el desafío vence a los 3 minutos y no se acepta con otra llave", async () => {
    const response = await handleSignIn(
      post("/api/auth/sign-in", { email: EMAIL, password: PASSWORD }),
      deps({ cognitoFetch: vi.fn<FetchLike>(async () => challengeResponse()) }),
    );
    const cookie = cookiesFrom(response).find((c) => c.startsWith(`${MFA_COOKIE}=`))!;
    const value = decodeURIComponent(cookie.split(";")[0].slice(MFA_COOKIE.length + 1));
    expect(decryptChallenge(value, KEY, NOW + 181_000)).toBeNull();
    expect(decryptChallenge(value, Buffer.alloc(32, 1), NOW)).toBeNull();
  });
});

describe("POST /api/auth/mfa/challenge", () => {
  async function pendingCookie() {
    const response = await handleSignIn(
      post("/api/auth/sign-in", { email: EMAIL, password: PASSWORD }),
      deps({ cognitoFetch: vi.fn<FetchLike>(async () => challengeResponse()) }),
    );
    return cookiesFrom(response)
      .find((c) => c.startsWith(`${MFA_COOKIE}=`))!
      .split(";")[0];
  }

  it("responde el desafío con el código y crea la sesión", async () => {
    const access = jwt({ exp: nowSeconds + 900, username: "uuid-interno" });
    const cognitoFetch = vi.fn<FetchLike>(async () => cognitoTokens(access, "refresh-x"));
    const apiFetch = vi.fn<FetchLike>(async () => meResponse("admin", true));
    const response = await handleMfaChallenge(
      post("/api/auth/mfa/challenge", { code: "123456" }, { cookie: await pendingCookie() }),
      deps({ cognitoFetch, apiFetch }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ role: "admin", mfa_enabled: true });
    expect(JSON.stringify(body)).not.toContain(access);

    const { action, body: sent } = actionOf(cognitoFetch);
    expect(action).toBe("RespondToAuthChallenge");
    expect(sent).toMatchObject({
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: CHALLENGE_SESSION,
      ChallengeResponses: {
        USERNAME: "uuid-interno",
        SOFTWARE_TOKEN_MFA_CODE: "123456",
        SECRET_HASH: secretHash("uuid-interno", CONFIG.cognitoClientId, CONFIG.cognitoClientSecret),
      },
    });
    const cookies = cookiesFrom(response);
    expect(cookies.some((c) => c.startsWith("__Host-hindama_sesion="))).toBe(true);
    expect(cookies.find((c) => c.startsWith(`${MFA_COOKIE}=`))).toMatch(/Max-Age=0/i);
  });

  it("un código incorrecto da 422 y deja el desafío para reintentar", async () => {
    const response = await handleMfaChallenge(
      post("/api/auth/mfa/challenge", { code: "000000" }, { cookie: await pendingCookie() }),
      deps({ cognitoFetch: vi.fn<FetchLike>(async () => cognitoError("CodeMismatchException")) }),
    );
    expect(response.status).toBe(422);
    const problem = await response.json();
    expect(problem.errors[0]).toMatchObject({ field: "code", code: "auth.code_mismatch" });
    expect(cookiesFrom(response).some((c) => c.startsWith(`${MFA_COOKIE}=`))).toBe(false);
  });

  it("si la sesión del desafío venció, pide volver a escribir la contraseña", async () => {
    const response = await handleMfaChallenge(
      post("/api/auth/mfa/challenge", { code: "123456" }, { cookie: await pendingCookie() }),
      deps({ cognitoFetch: vi.fn<FetchLike>(async () => cognitoError("NotAuthorizedException")) }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("auth.mfa_expired");
    expect(cookiesFrom(response).find((c) => c.startsWith(`${MFA_COOKIE}=`))).toMatch(/Max-Age=0/i);
  });

  it("sin desafío pendiente no llama a Cognito", async () => {
    const cognitoFetch = vi.fn<FetchLike>();
    const response = await handleMfaChallenge(
      post("/api/auth/mfa/challenge", { code: "123456" }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("auth.mfa_expired");
    expect(cognitoFetch).not.toHaveBeenCalled();
  });

  it.each([["12345"], ["1234567"], ["abcdef"], [""]])("rechaza el código %j", async (code) => {
    const cognitoFetch = vi.fn<FetchLike>();
    const response = await handleMfaChallenge(
      post("/api/auth/mfa/challenge", { code }, { cookie: await pendingCookie() }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(422);
    expect(cognitoFetch).not.toHaveBeenCalled();
  });

  it("verifica el Origin", async () => {
    const response = await handleMfaChallenge(
      post(
        "/api/auth/mfa/challenge",
        { code: "123456" },
        { origin: "https://otro.example", cookie: await pendingCookie() },
      ),
      deps(),
    );
    expect(response.status).toBe(403);
  });
});

describe("activar el segundo factor (V-10, V-11)", () => {
  it("setup: AssociateSoftwareToken con el access token y devuelve solo la clave", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async () =>
      Response.json({ SecretCode: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", Session: "x" }),
    );
    const response = await handleMfaSetup(authed("/api/auth/mfa/setup"), deps({ cognitoFetch }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });
    const { action, body } = actionOf(cognitoFetch);
    expect(action).toBe("AssociateSoftwareToken");
    expect(body.AccessToken).toBe(session().accessToken);
  });

  it("setup exige sesión, Origin y token CSRF", async () => {
    const cognitoFetch = vi.fn<FetchLike>();
    const noSession = await handleMfaSetup(post("/api/auth/mfa/setup"), deps({ cognitoFetch }));
    expect(noSession.status).toBe(401);
    const noCsrf = await handleMfaSetup(
      authed("/api/auth/mfa/setup", undefined, { "x-csrf-token": "otro" }),
      deps({ cognitoFetch }),
    );
    expect(noCsrf.status).toBe(403);
    expect(cognitoFetch).not.toHaveBeenCalled();
  });

  it("verify: comprueba el código y deja el TOTP como preferido", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async (_url, init) => {
      const target = new Headers(init.headers).get("x-amz-target") ?? "";
      return target.endsWith("VerifySoftwareToken")
        ? Response.json({ Status: "SUCCESS" })
        : Response.json({});
    });
    const response = await handleMfaVerify(
      authed("/api/auth/mfa/verify", { code: "654321" }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(204);
    expect(actionOf(cognitoFetch, 0)).toMatchObject({
      action: "VerifySoftwareToken",
      body: { UserCode: "654321" },
    });
    expect(actionOf(cognitoFetch, 1)).toMatchObject({
      action: "SetUserMFAPreference",
      body: { SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true } },
    });
  });

  it.each([
    ["Status ERROR", async () => Response.json({ Status: "ERROR" })],
    [
      "EnableSoftwareTokenMFAException",
      async () => cognitoError("EnableSoftwareTokenMFAException"),
    ],
  ])("verify con un código incorrecto (%s) da 422 y no activa nada", async (_label, reply) => {
    const cognitoFetch = vi.fn<FetchLike>(reply);
    const response = await handleMfaVerify(
      authed("/api/auth/mfa/verify", { code: "000000" }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).errors[0]).toMatchObject({ field: "code" });
    expect(cognitoFetch).toHaveBeenCalledTimes(1);
  });

  it("renueva el access token si le quedan menos de 5 minutos antes de llamar a Cognito", async () => {
    const stale = session({ accessToken: jwt({ exp: nowSeconds + 60, username: "uuid-interno" }) });
    const fresh = jwt({ exp: nowSeconds + 900, username: "uuid-interno" });
    const cognitoFetch = vi.fn<FetchLike>(async (_url, init) => {
      const target = new Headers(init.headers).get("x-amz-target") ?? "";
      if (target.endsWith("InitiateAuth")) return cognitoTokens(fresh);
      return Response.json({ SecretCode: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });
    });
    const response = await handleMfaSetup(
      authed("/api/auth/mfa/setup", undefined, { cookie: sessionCookie(stale) }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(200);
    expect(actionOf(cognitoFetch, 0).action).toBe("InitiateAuth");
    expect(actionOf(cognitoFetch, 1).body.AccessToken).toBe(fresh);
    expect(cookiesFrom(response).some((c) => c.startsWith("__Host-hindama_sesion="))).toBe(true);
  });
});

describe("desactivar el segundo factor (V-09, RF-87)", () => {
  const replyFor = (target: string) =>
    target.endsWith("VerifySoftwareToken")
      ? Response.json({ Status: "SUCCESS" })
      : Response.json({});

  it("pide un código vigente y desactiva el TOTP", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async (_url, init) =>
      replyFor(new Headers(init.headers).get("x-amz-target") ?? ""),
    );
    const apiFetch = vi.fn<FetchLike>(async () => meResponse("analyst", true));
    const response = await handleMfaDisable(
      authed("/api/auth/mfa/disable", { code: "111222" }),
      deps({ cognitoFetch, apiFetch }),
    );
    expect(response.status).toBe(204);
    expect(actionOf(cognitoFetch, 0).action).toBe("VerifySoftwareToken");
    expect(actionOf(cognitoFetch, 1)).toMatchObject({
      action: "SetUserMFAPreference",
      body: { SoftwareTokenMfaSettings: { Enabled: false } },
    });
  });

  it("el administrador no puede desactivarlo (CU-22 E2) y no se llama a Cognito", async () => {
    const cognitoFetch = vi.fn<FetchLike>();
    const apiFetch = vi.fn<FetchLike>(async () => meResponse("admin", true));
    const response = await handleMfaDisable(
      authed("/api/auth/mfa/disable", { code: "111222" }),
      deps({ cognitoFetch, apiFetch }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("role.forbidden");
    expect(cognitoFetch).not.toHaveBeenCalled();
  });

  it("con un código incorrecto no desactiva nada", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async () => Response.json({ Status: "ERROR" }));
    const response = await handleMfaDisable(
      authed("/api/auth/mfa/disable", { code: "000000" }),
      deps({ cognitoFetch, apiFetch: vi.fn<FetchLike>(async () => meResponse("analyst", true)) }),
    );
    expect(response.status).toBe(422);
    expect(cognitoFetch).toHaveBeenCalledTimes(1);
  });
});
