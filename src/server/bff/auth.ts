import type { z } from "zod";
import { meSchema } from "@/lib/api/schemas/account";
import {
  confirmSignUpSchema,
  emailOnlySchema,
  mfaCodeSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/api/schemas/auth";
import { fieldErrors } from "@/lib/api/zod";
import {
  associateSoftwareToken,
  CognitoError,
  CognitoMfaChallenge,
  confirmForgotPassword,
  confirmSignUp,
  forgotPassword,
  refreshTokens,
  resendConfirmationCode,
  respondToMfaChallenge,
  revokeRefreshToken,
  setSoftwareTokenMfa,
  signInWithPassword,
  signUp,
  verifySoftwareToken,
} from "./cognito";
import { parseCookieHeader, SetCookieCollector } from "./cookies";
import { isAllowedOrigin, isValidCsrfToken } from "./csrf";
import type { BffDeps } from "./deps";
import { needsRefresh } from "./jwt";
import { clearChallenge, readChallenge, writeChallenge } from "./mfa-challenge";
import { problem } from "./problem";
import { newRequestId } from "./request-context";
import { readJsonBody } from "./route";
import {
  clearSession,
  newCsrfToken,
  readSession,
  writeSession,
  type CookieReader,
  type Session,
} from "./session";

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
    case "EnableSoftwareTokenMFAException":
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

interface Account {
  role: "analyst" | "admin";
  mfaEnabled: boolean;
}

/**
 * Primer `GET /me` tras iniciar sesión (guía §2.5 y §5.1): da de alta al usuario en la API y
 * devuelve su rol y si tiene el segundo factor, que solo sirven para elegir la pantalla inicial.
 * Si la API no responde, la sesión sigue siendo válida y la pantalla siguiente vuelve a pedir `/me`.
 */
async function readAccount(accessToken: string, deps: BffDeps): Promise<Account | null> {
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
    return parsed.success ? { role: parsed.data.role, mfaEnabled: parsed.data.mfa_enabled } : null;
  } catch {
    return null;
  }
}

/** Crea la sesión con los tokens que dio Cognito y responde con el token anti-CSRF y la cuenta. */
async function startSession(
  request: Request,
  deps: BffDeps,
  tokens: { accessToken: string; refreshToken: string; username: string },
  collector: SetCookieCollector,
): Promise<Response> {
  const session = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    username: tokens.username,
    csrf: newCsrfToken(),
  };
  writeSession(collector, session, deps.key, parseCookieHeader(request.headers.get("cookie")));
  const account = await readAccount(session.accessToken, deps);
  const response = json({
    csrf_token: session.csrf,
    role: account?.role ?? null,
    mfa_enabled: account?.mfaEnabled ?? null,
  });
  collector.applyTo(response.headers);
  return response;
}

/**
 * `POST /api/auth/sign-in`: inicia sesión con `USER_PASSWORD_AUTH` y crea la cookie cifrada. Si la
 * cuenta tiene el segundo factor, Cognito pide el código: no hay sesión todavía; el desafío queda
 * en una cookie cifrada de 3 minutos y la respuesta es `{ mfa_required: true }`.
 */
export async function handleSignIn(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, signInSchema);
  if (!body.ok) return body.response;
  const { email, password } = body.value;

  try {
    const tokens = await signInWithPassword(deps.config, email, password, deps.cognitoFetch);
    return await startSession(request, deps, tokens, new SetCookieCollector());
  } catch (error) {
    if (error instanceof CognitoMfaChallenge) {
      const collector = new SetCookieCollector();
      writeChallenge(
        collector,
        { email, username: error.username, session: error.session },
        deps.key,
        deps.now(),
      );
      const response = json({ mfa_required: true });
      collector.applyTo(response.headers);
      return response;
    }
    if (error instanceof CognitoError) return cognitoProblem(error);
    return problem(503, "service.unavailable");
  }
}

/**
 * `POST /api/auth/mfa/challenge` (V-05, V-35): completa el inicio de sesión con el código TOTP
 * (`RespondToAuthChallenge`). Un código incorrecto deja el desafío vivo para reintentar; si
 * venció, la persona vuelve a escribir su contraseña (401 `auth.mfa_expired`).
 */
export async function handleMfaChallenge(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, mfaCodeSchema);
  if (!body.ok) return body.response;
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const challenge = readChallenge(cookies, deps.key, deps.now());
  const collector = new SetCookieCollector();
  if (!challenge) {
    clearChallenge(collector);
    const response = problem(401, "auth.mfa_expired");
    collector.applyTo(response.headers);
    return response;
  }

  try {
    const tokens = await respondToMfaChallenge(
      deps.config,
      { ...challenge, code: body.value.code },
      deps.cognitoFetch,
    );
    clearChallenge(collector);
    return await startSession(request, deps, tokens, collector);
  } catch (error) {
    let response: Response;
    if (error instanceof CognitoError && error.type === "NotAuthorizedException") {
      // La `Session` del desafío venció o ya se usó.
      clearChallenge(collector);
      response = problem(401, "auth.mfa_expired");
    } else if (error instanceof CognitoError) {
      response = cognitoProblem(error);
    } else {
      response = problem(503, "service.unavailable");
    }
    collector.applyTo(response.headers);
    return response;
  }
}

/**
 * Sesión para las rutas del segundo factor: comprueba `Origin` y el token anti-CSRF y renueva el
 * access token si le quedan menos de 5 minutos. Usan el access token directamente contra Cognito.
 */
async function mfaSession(
  request: Request,
  deps: BffDeps,
  collector: SetCookieCollector,
): Promise<{ ok: true; session: Session } | { ok: false; response: Response }> {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const session = readSession(cookies, deps.key);
  if (!session) return { ok: false, response: problem(401, "auth.required") };
  if (
    !isAllowedOrigin(request.headers, deps.config.publicOrigin) ||
    !isValidCsrfToken(request.headers, session)
  )
    return { ok: false, response: problem(403, "csrf.invalid") };
  if (!needsRefresh(session.accessToken, deps.now())) return { ok: true, session };
  try {
    return { ok: true, session: await renewSession(session, deps, collector, cookies) };
  } catch {
    clearSession(collector, cookies);
    return { ok: false, response: problem(401, "auth.invalid_token") };
  }
}

async function renewSession(
  session: Session,
  deps: BffDeps,
  collector: SetCookieCollector,
  cookies: CookieReader,
): Promise<Session> {
  const tokens = await refreshTokens(
    deps.config,
    session.username,
    session.refreshToken,
    deps.cognitoFetch,
  );
  const next = {
    ...session,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? session.refreshToken,
  };
  writeSession(collector, next, deps.key, cookies);
  return next;
}

/** Corre una acción del segundo factor con la sesión y traduce los errores de Cognito. */
async function mfaAction(
  request: Request,
  deps: BffDeps,
  run: (session: Session) => Promise<Response>,
): Promise<Response> {
  const collector = new SetCookieCollector();
  const auth = await mfaSession(request, deps, collector);
  let response: Response;
  if (!auth.ok) {
    response = auth.response;
  } else {
    try {
      response = await run(auth.session);
    } catch (error) {
      response =
        error instanceof CognitoError ? cognitoProblem(error) : problem(503, "service.unavailable");
    }
  }
  collector.applyTo(response.headers);
  return response;
}

/** `POST /api/auth/mfa/setup` (V-10, V-11): `AssociateSoftwareToken`; devuelve la clave TOTP. */
export async function handleMfaSetup(request: Request, deps: BffDeps): Promise<Response> {
  return mfaAction(request, deps, async (session) => {
    const secret = await associateSoftwareToken(
      deps.config,
      session.accessToken,
      deps.cognitoFetch,
    );
    return json({ secret });
  });
}

/**
 * `POST /api/auth/mfa/verify` (V-10, V-11): `VerifySoftwareToken` con el primer código y, si es
 * correcto, `SetUserMFAPreference` para que Cognito lo pida en cada inicio de sesión.
 */
export async function handleMfaVerify(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, mfaCodeSchema);
  if (!body.ok) return body.response;
  return mfaAction(request, deps, async (session) => {
    await verifySoftwareToken(deps.config, session.accessToken, body.value.code, deps.cognitoFetch);
    await setSoftwareTokenMfa(deps.config, session.accessToken, true, deps.cognitoFetch);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  });
}

/**
 * `POST /api/auth/mfa/disable` (V-09, RF-87): pide un código vigente y desactiva el TOTP. El
 * administrador no puede desactivarlo (CU-22 E2, RF-86): se comprueba con `GET /me`.
 */
export async function handleMfaDisable(request: Request, deps: BffDeps): Promise<Response> {
  const body = await readAuthBody(request, deps, mfaCodeSchema);
  if (!body.ok) return body.response;
  return mfaAction(request, deps, async (session) => {
    const account = await readAccount(session.accessToken, deps);
    if (account?.role === "admin") return problem(403, "role.forbidden");
    await verifySoftwareToken(deps.config, session.accessToken, body.value.code, deps.cognitoFetch);
    await setSoftwareTokenMfa(deps.config, session.accessToken, false, deps.cognitoFetch);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  });
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
