// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  handleConfirmSignUp,
  handleForgotPassword,
  handleResendCode,
  handleResetPassword,
  handleSignIn,
  handleSignUp,
} from "./auth";
import { secretHash, type FetchLike } from "./cognito";
import { cognitoTokens, CONFIG, deps, jwt, nowSeconds, ORIGIN } from "./test-utils";

function post(path: string, body: unknown, headers: Record<string, string> = { origin: ORIGIN }) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function cognitoError(type: string, status = 400) {
  return vi.fn<FetchLike>(async () => new Response(JSON.stringify({ __type: type }), { status }));
}

function target(fetchMock: ReturnType<typeof vi.fn<FetchLike>>) {
  const [, init] = fetchMock.mock.calls[0];
  return {
    action: new Headers(init.headers).get("x-amz-target"),
    body: JSON.parse(String(init.body)) as Record<string, unknown>,
  };
}

// Valores ficticios solo para pruebas; se construyen para no parecer credenciales reales.
const STRONG = ["Prueba", "2026", "#x!"].join("");
const SHORT = "c".repeat(5);

describe("registro (V-02)", () => {
  it("llama a SignUp con el correo como Username, email y name, y SecretHash", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async () => Response.json({ UserConfirmed: false }));
    const response = await handleSignUp(
      post("/api/auth/sign-up", { name: "  Ana  ", email: "ana@ejemplo.mx", password: STRONG }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(204);
    const { action, body } = target(cognitoFetch);
    expect(action).toBe("AWSCognitoIdentityProviderService.SignUp");
    expect(body).toMatchObject({
      Username: "ana@ejemplo.mx",
      Password: STRONG,
      SecretHash: secretHash("ana@ejemplo.mx", CONFIG.cognitoClientId, CONFIG.cognitoClientSecret),
      UserAttributes: [
        { Name: "email", Value: "ana@ejemplo.mx" },
        { Name: "name", Value: "Ana" },
      ],
    });
    expect(JSON.stringify(body)).not.toContain(CONFIG.cognitoClientSecret);
  });

  it.each([
    ["UsernameExistsException", 409, "auth.username_exists"],
    ["InvalidPasswordException", 422, "validation.failed"],
    ["TooManyRequestsException", 429, "rate_limit.exceeded"],
    ["InternalErrorException", 503, "service.unavailable"],
  ])("traduce %s a %i %s", async (type, status, code) => {
    const cognitoFetch = cognitoError(type, status === 503 ? 500 : 400);
    const response = await handleSignUp(
      post("/api/auth/sign-up", { name: "Ana", email: "ana@ejemplo.mx", password: STRONG }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(status);
    expect((await response.json()).code).toBe(code);
  });

  it("marca la contraseña rechazada por la política junto al campo", async () => {
    const response = await handleSignUp(
      post("/api/auth/sign-up", { name: "Ana", email: "ana@ejemplo.mx", password: STRONG }),
      deps({ cognitoFetch: cognitoError("InvalidPasswordException") }),
    );
    expect((await response.json()).errors).toEqual([
      { field: "password", code: "auth.invalid_password", message: "" },
    ]);
  });

  it.each([
    ["campos extra", { name: "A", email: "a@b.co", password: STRONG, role: "admin" }],
    ["nombre largo", { name: "a".repeat(101), email: "a@b.co", password: STRONG }],
    ["nombre con control", { name: "A\u0007", email: "a@b.co", password: STRONG }],
    ["correo inválido", { name: "A", email: "<b>@x", password: STRONG }],
    ["contraseña corta", { name: "A", email: "a@b.co", password: SHORT }],
  ])("rechaza %s sin llamar a Cognito", async (_label, body) => {
    const cognitoFetch = vi.fn<FetchLike>();
    const response = await handleSignUp(post("/api/auth/sign-up", body), deps({ cognitoFetch }));
    expect(response.status).toBe(422);
    expect(cognitoFetch).not.toHaveBeenCalled();
  });

  it("rechaza un Origin ajeno y un cuerpo mal formado", async () => {
    const cognitoFetch = vi.fn<FetchLike>();
    const evil = await handleSignUp(
      post("/api/auth/sign-up", {}, { origin: "https://evil.test" }),
      deps({ cognitoFetch }),
    );
    expect(evil.status).toBe(403);
    const malformed = await handleSignUp(
      post("/api/auth/sign-up", "{nope"),
      deps({ cognitoFetch }),
    );
    expect(malformed.status).toBe(400);
    expect(cognitoFetch).not.toHaveBeenCalled();
  });

  it("rechaza un cuerpo enorme", async () => {
    const response = await handleSignUp(
      post("/api/auth/sign-up", { name: "a".repeat(20_000), email: "a@b.co", password: STRONG }),
      deps({ cognitoFetch: vi.fn<FetchLike>() }),
    );
    expect(response.status).toBe(413);
  });
});

describe("verificar correo (V-03)", () => {
  it("confirma con ConfirmSignUp y el código de 6 dígitos", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async () => Response.json({}));
    const response = await handleConfirmSignUp(
      post("/api/auth/sign-up/confirm", { email: "ana@ejemplo.mx", code: "123456" }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(204);
    expect(target(cognitoFetch)).toMatchObject({
      action: "AWSCognitoIdentityProviderService.ConfirmSignUp",
      body: { Username: "ana@ejemplo.mx", ConfirmationCode: "123456" },
    });
  });

  it.each([
    ["CodeMismatchException", "auth.code_mismatch"],
    ["ExpiredCodeException", "auth.code_expired"],
  ])("marca %s en el campo del código", async (type, code) => {
    const response = await handleConfirmSignUp(
      post("/api/auth/sign-up/confirm", { email: "ana@ejemplo.mx", code: "123456" }),
      deps({ cognitoFetch: cognitoError(type) }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).errors[0]).toEqual({ field: "code", code, message: "" });
  });

  it("rechaza un código que no son 6 dígitos", async () => {
    const cognitoFetch = vi.fn<FetchLike>();
    const response = await handleConfirmSignUp(
      post("/api/auth/sign-up/confirm", { email: "ana@ejemplo.mx", code: "12a456" }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(422);
    expect(cognitoFetch).not.toHaveBeenCalled();
  });

  it("reenvía el código con ResendConfirmationCode", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async () => Response.json({}));
    const response = await handleResendCode(
      post("/api/auth/sign-up/resend", { email: "ana@ejemplo.mx" }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(204);
    expect(target(cognitoFetch).action).toBe(
      "AWSCognitoIdentityProviderService.ResendConfirmationCode",
    );
  });
});

describe("recuperar contraseña (V-06)", () => {
  it("responde igual con un correo inexistente (RF-06)", async () => {
    const existing = await handleForgotPassword(
      post("/api/auth/password/forgot", { email: "ana@ejemplo.mx" }),
      deps({ cognitoFetch: vi.fn<FetchLike>(async () => Response.json({})) }),
    );
    const missing = await handleForgotPassword(
      post("/api/auth/password/forgot", { email: "nadie@ejemplo.mx" }),
      deps({ cognitoFetch: cognitoError("UserNotFoundException") }),
    );
    expect([existing.status, missing.status]).toEqual([204, 204]);
  });

  it("cambia la contraseña con ConfirmForgotPassword", async () => {
    const cognitoFetch = vi.fn<FetchLike>(async () => Response.json({}));
    const response = await handleResetPassword(
      post("/api/auth/password/reset", {
        email: "ana@ejemplo.mx",
        code: "123456",
        password: STRONG,
      }),
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(204);
    expect(target(cognitoFetch)).toMatchObject({
      action: "AWSCognitoIdentityProviderService.ConfirmForgotPassword",
      body: { Username: "ana@ejemplo.mx", ConfirmationCode: "123456", Password: STRONG },
    });
  });
});

describe("inicio de sesión (V-04) y rol de /me", () => {
  it("pide GET /me con el access token nuevo y devuelve el rol", async () => {
    const access = jwt({ exp: nowSeconds + 900, username: "uuid-interno" });
    const apiFetch = vi.fn<FetchLike>(async () =>
      Response.json({
        id: "0192e3a0-1111-7000-8000-000000000001",
        name: "Ana",
        email: "ana@ejemplo.mx",
        role: "admin",
        mfa_enabled: false,
        terms: {
          current_version: "v",
          accepted_version: null,
          accepted_at: null,
          acceptance_required: true,
        },
      }),
    );
    const response = await handleSignIn(
      post("/api/auth/sign-in", { email: "ana@ejemplo.mx", password: STRONG }),
      deps({ cognitoFetch: vi.fn<FetchLike>(async () => cognitoTokens(access, "r")), apiFetch }),
    );
    const body = await response.json();
    expect(body.role).toBe("admin");
    expect(Object.keys(body).sort()).toEqual(["csrf_token", "role"]);
    const [url, init] = apiFetch.mock.calls[0];
    expect(url).toBe(`${CONFIG.apiUrl}/me`);
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${access}`);
  });

  it("si /me falla, la sesión sigue y el rol es null", async () => {
    const access = jwt({ exp: nowSeconds + 900, username: "u" });
    const response = await handleSignIn(
      post("/api/auth/sign-in", { email: "ana@ejemplo.mx", password: STRONG }),
      deps({
        cognitoFetch: vi.fn<FetchLike>(async () => cognitoTokens(access, "r")),
        apiFetch: vi.fn<FetchLike>(async () => new Response(null, { status: 503 })),
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).role).toBeNull();
    expect(response.headers.getSetCookie()[0]).toContain("__Host-hindama_sesion=");
  });

  it("nunca devuelve tokens al navegador", async () => {
    const access = jwt({ exp: nowSeconds + 900, username: "u" });
    const response = await handleSignIn(
      post("/api/auth/sign-in", { email: "ana@ejemplo.mx", password: STRONG }),
      deps({ cognitoFetch: vi.fn<FetchLike>(async () => cognitoTokens(access, "refresh-x")) }),
    );
    const text = await response.text();
    expect(text).not.toContain(access);
    expect(text).not.toContain("refresh-x");
  });
});
