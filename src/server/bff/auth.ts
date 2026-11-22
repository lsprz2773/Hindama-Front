import type { z } from "zod";
import { meSchema } from "@/lib/api/schemas/account";
import {
  confirmSignUpSchema,
  emailOnlySchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/api/schemas/auth";
import { fieldErrors } from "@/lib/api/zod";
import {
  CognitoError,
  confirmForgotPassword,
  confirmSignUp,
  forgotPassword,
  resendConfirmationCode,
  revokeRefreshToken,
  signInWithPassword,
  signUp,
} from "./cognito";
import { parseCookieHeader, SetCookieCollector } from "./cookies";
import { isAllowedOrigin, isValidCsrfToken } from "./csrf";
import type { BffDeps } from "./deps";
import { problem } from "./problem";
import { newRequestId } from "./request-context";
import { readJsonBody } from "./route";
import { clearSession, newCsrfToken, readSession, writeSession } from "./session";

/** Los cuerpos de acceso son pequeños; más de 8 KB no es un formulario legítimo. */
const MAX_AUTH_BODY_BYTES = 8 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Errores de Cognito → respuesta al navegador (guía del frontend, sección 2.4). Con credenciales
 * incorrectas no se revela si el correo existe (RF-06): `NotAuthorizedException` y
 * `UserNotFoundException` dan lo mismo.
 */
function cognitoProblem(error: CognitoError): Response {
  switch (error.type) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return problem(401, "auth.invalid_credentials");
    case "UserNotConfirmedException":
      return problem(403, "auth.user_not_confirmed");
    case "UsernameExistsException":
      return problem(409, "auth.username_exists");
    case "InvalidPasswordException":
      return problem(422, "validation.failed", {
        errors: [{ field: "password", code: "auth.invalid_password", message: "" }],
      });
    case "CodeMismatchException":
      return problem(422, "validation.failed", {
        errors: [{ field: "code", code: "auth.code_mismatch", message: "" }],
      });
    case "ExpiredCodeException":
      return problem(422, "validation.failed", {
        errors: [{ field: "code", code: "auth.code_expired", message: "" }],
      });
    case "TooManyRequestsException":
    case "LimitExceededException":
    case "TooManyFailedAttemptsException":
      return problem(429, "rate_limit.exceeded");
    default:
      return error.status >= 500
        ? problem(503, "service.unavailable")
        : problem(400, "auth.failed");
  }
}

/**
 * Lee y valida el cuerpo de una ruta de acceso. Antes de la sesión no hay token anti-CSRF: se
 * verifica el `Origin` (CSRF de inicio de sesión). Los cuerpos nunca se registran (guía §2.4).
 */
async function readAuthBody<S extends z.ZodType>(
  request: Request,
  deps: BffDeps,
  schema: S,
): Promise<{ ok: true; value: z.output<S> } | { ok: false; response: Response }> {
  if (!isAllowedOrigin(request.headers, deps.config.publicOrigin)) {
    return { ok: false, response: problem(403, "csrf.invalid") };
  }
  const read = await readJsonBody(request, MAX_AUTH_BODY_BYTES);
  if (!read.ok) return read;
  const parsed = schema.safeParse(read.value);
  if (!parsed.success) {
    const errors = Object.entries(fieldErrors(parsed.error)).flatMap(([field, codes]) =>
      codes.map((code) => ({ field: field === "_" ? null : field, code, message: "" })),
    );
    return { ok: false, response: problem(422, "validation.failed", { errors }) };
  }
  return { ok: true, value: parsed.data };
}

/** Ejecuta una llamada a Cognito y traduce sus errores; sin errores responde 204. */
async function cognitoAction(run: () => Promise<void>): Promise<Response> {
  try {
    await run();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CognitoError) return cognitoProblem(error);
    return problem(503, "service.unavailable");
  }
}

/**
 * Primer `GET /me` tras iniciar sesión (guía §2.5 y §5.1): da de alta al usuario en la API y
 * devuelve su rol, que solo sirve para elegir la pantalla inicial. Si la API no responde, la
 * sesión sigue siendo válida y la pantalla siguiente vuelve a pedir `/me`.
 */
async function readRole(accessToken: string, deps: BffDeps): Promise<"analyst" | "admin" | null> {
  try {
    const response = await deps.apiFetch(`${deps.config.apiUrl}/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-Request-Id": newRequestId(),
      },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const parsed = meSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.role : null;
  } catch {
    return null;
  }
}

/** `POST /api/auth/sign-in`: inicia sesión con `USER_PASSWORD_AUTH` y crea la cookie cifrada. */
export async function handleSignIn(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, signInSchema);
  if (!body.ok) return body.response;
  const { email, password } = body.value;

  try {
    const tokens = await signInWithPassword(deps.config, email, password, deps.cognitoFetch);
    const session = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      username: tokens.username,
      csrf: newCsrfToken(),
    };
    const collector = new SetCookieCollector();
    writeSession(collector, session, deps.key, parseCookieHeader(request.headers.get("cookie")));
    const role = await readRole(session.accessToken, deps);
    const response = json({ csrf_token: session.csrf, role });
    collector.applyTo(response.headers);
    return response;
  } catch (error) {
    if (error instanceof CognitoError) return cognitoProblem(error);
    return problem(503, "service.unavailable");
  }
}

/** `POST /api/auth/sign-up` (V-02, RF-01): `SignUp` en Cognito. */
export async function handleSignUp(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, signUpSchema);
  if (!body.ok) return body.response;
  return cognitoAction(() => signUp(deps.config, body.value, deps.cognitoFetch));
}

/** `POST /api/auth/sign-up/confirm` (V-03, RF-02): `ConfirmSignUp`. */
export async function handleConfirmSignUp(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, confirmSignUpSchema);
  if (!body.ok) return body.response;
  const { email, code } = body.value;
  return cognitoAction(() => confirmSignUp(deps.config, email, code, deps.cognitoFetch));
}

/** `POST /api/auth/sign-up/resend` (V-03): `ResendConfirmationCode`. */
export async function handleResendCode(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, emailOnlySchema);
  if (!body.ok) return body.response;
  return cognitoAction(() =>
    resendConfirmationCode(deps.config, body.value.email, deps.cognitoFetch),
  );
}

/**
 * `POST /api/auth/password/forgot` (V-06, RF-05): `ForgotPassword`. Un correo inexistente
 * responde igual que uno registrado, para no revelar qué cuentas existen (RF-06).
 */
export async function handleForgotPassword(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, emailOnlySchema);
  if (!body.ok) return body.response;
  return cognitoAction(async () => {
    try {
      await forgotPassword(deps.config, body.value.email, deps.cognitoFetch);
    } catch (error) {
      if (error instanceof CognitoError && error.type === "UserNotFoundException") return;
      throw error;
    }
  });
}

/** `POST /api/auth/password/reset` (V-06, RF-05): `ConfirmForgotPassword`. */
export async function handleResetPassword(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, resetPasswordSchema);
  if (!body.ok) return body.response;
  return cognitoAction(() => confirmForgotPassword(deps.config, body.value, deps.cognitoFetch));
}

/** `GET /api/auth/session`: dice si hay sesión y entrega el token anti-CSRF; nunca los tokens. */
export async function handleSession(request: Request, deps: BffDeps): Promise<Response> {
  const session = readSession(parseCookieHeader(request.headers.get("cookie")), deps.key);
  if (!session) return problem(401, "auth.required");
  return json({ authenticated: true, csrf_token: session.csrf });
}

/**
 * `POST /api/auth/sign-out`: `RevokeToken` con el refresh token y después borra la cookie
 * (RF-04). Si Cognito no responde, la cookie se borra igual y responde `revoked: false`.
 */
export async function handleSignOut(request: Request, deps: BffDeps): Promise<Response> {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const session = readSession(cookies, deps.key);
  if (!isAllowedOrigin(request.headers, deps.config.publicOrigin))
    return problem(403, "csrf.invalid");
  if (session && !isValidCsrfToken(request.headers, session)) return problem(403, "csrf.invalid");

  let revoked = true;
  if (session) {
    try {
      await revokeRefreshToken(deps.config, session.refreshToken, deps.cognitoFetch);
    } catch {
      // La cookie se borra aunque la revocación falle; el refresh token vence a los 7 días.
      // `revoked: false` avisa al usuario de que la sesión solo se cerró en este navegador.
      revoked = false;
    }
  }
  const collector = new SetCookieCollector();
  clearSession(collector, cookies);
  const response = json({ revoked });
  collector.applyTo(response.headers);
  return response;
}
