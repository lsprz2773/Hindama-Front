import { CognitoError, revokeRefreshToken, signInWithPassword } from "./cognito";
import { parseCookieHeader, SetCookieCollector } from "./cookies";
import { isAllowedOrigin, isValidCsrfToken } from "./csrf";
import type { BffDeps } from "./deps";
import { problem } from "./problem";
import { clearSession, newCsrfToken, readSession, writeSession } from "./session";

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
    case "TooManyRequestsException":
    case "LimitExceededException":
      return problem(429, "rate_limit.exceeded");
    default:
      return error.status >= 500
        ? problem(503, "service.unavailable")
        : problem(400, "auth.failed");
  }
}

/** `POST /api/auth/sign-in`: inicia sesión con `USER_PASSWORD_AUTH` y crea la cookie cifrada. */
export async function handleSignIn(request: Request, deps: BffDeps): Promise<Response> {
  // Antes de la sesión no hay token anti-CSRF: se verifica el `Origin` (CSRF de inicio de sesión).
  if (!isAllowedOrigin(request.headers, deps.config.publicOrigin))
    return problem(403, "csrf.invalid");

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return problem(400, "request.malformed");
  }
  const { email, password } = (input ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || !email || typeof password !== "string" || !password) {
    return problem(422, "validation.failed");
  }

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
    const response = json({ csrf_token: session.csrf });
    collector.applyTo(response.headers);
    return response;
  } catch (error) {
    if (error instanceof CognitoError) return cognitoProblem(error);
    return problem(503, "service.unavailable");
  }
}

/** `GET /api/auth/session`: dice si hay sesión y entrega el token anti-CSRF; nunca los tokens. */
export async function handleSession(request: Request, deps: BffDeps): Promise<Response> {
  const session = readSession(parseCookieHeader(request.headers.get("cookie")), deps.key);
  if (!session) return problem(401, "auth.required");
  return json({ authenticated: true, csrf_token: session.csrf });
}

/**
 * `POST /api/auth/sign-out`: `RevokeToken` con el refresh token y después borra la cookie
 * (RF-04). Si Cognito no responde, la cookie se borra igual.
 */
export async function handleSignOut(request: Request, deps: BffDeps): Promise<Response> {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const session = readSession(cookies, deps.key);
  if (!isAllowedOrigin(request.headers, deps.config.publicOrigin))
    return problem(403, "csrf.invalid");
  if (session && !isValidCsrfToken(request.headers, session)) return problem(403, "csrf.invalid");

  if (session) {
    try {
      await revokeRefreshToken(deps.config, session.refreshToken, deps.cognitoFetch);
    } catch {
      // La cookie se borra aunque la revocación falle; el refresh token vence a los 7 días.
    }
  }
  const collector = new SetCookieCollector();
  clearSession(collector, cookies);
  const response = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  collector.applyTo(response.headers);
  return response;
}
