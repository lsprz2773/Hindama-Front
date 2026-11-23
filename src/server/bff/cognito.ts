import { createHmac } from "node:crypto";
import type { BffConfig } from "./config";
import { decodeClaims } from "./jwt";

/**
 * Llamadas a Cognito desde el servidor con el cliente confidencial (ADR-005, guía del
 * frontend secciones 2.3 y 2.4): registro, confirmación del correo, recuperación de la contraseña,
 * `USER_PASSWORD_AUTH`, `REFRESH_TOKEN_AUTH`, `RevokeToken` y el segundo factor TOTP (guía §5.1,
 * ADR-018). Ninguna necesita credenciales de AWS: se autentican con el Client ID y el
 * `SECRET_HASH`, o con el access token de la sesión en las del segundo factor. El secreto del
 * cliente nunca sale del servidor. No se registran cuerpos ni tokens.
 */

/** Base64(HMAC-SHA256(llave = secreto del cliente, mensaje = username + client_id)). */
export function secretHash(username: string, clientId: string, clientSecret: string): string {
  return createHmac("sha256", clientSecret)
    .update(username + clientId)
    .digest("base64");
}

export class CognitoError extends Error {
  constructor(
    /** Nombre de la excepción de Cognito (`NotAuthorizedException`…). */
    readonly type: string,
    readonly status: number,
  ) {
    super(type);
    this.name = "CognitoError";
  }
}

/**
 * `InitiateAuth` respondió con el desafío `SOFTWARE_TOKEN_MFA`: falta el código TOTP. Lleva la
 * `Session` del desafío (vale unos minutos) y el nombre con que Cognito espera la respuesta.
 */
export class CognitoMfaChallenge extends CognitoError {
  constructor(
    readonly session: string,
    /** `USER_ID_FOR_SRP` del desafío: el `username` interno de la cuenta. */
    readonly username: string | undefined,
  ) {
    super("MfaChallenge", 200);
    this.name = "CognitoMfaChallenge";
  }
}

export interface Tokens {
  accessToken: string;
  /** Solo viene al iniciar sesión; la renovación conserva el anterior. */
  refreshToken?: string;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

async function call(
  config: BffConfig,
  action:
    | "InitiateAuth"
    | "RevokeToken"
    | "SignUp"
    | "ConfirmSignUp"
    | "ResendConfirmationCode"
    | "ForgotPassword"
    | "ConfirmForgotPassword"
    | "RespondToAuthChallenge"
    | "AssociateSoftwareToken"
    | "VerifySoftwareToken"
    | "SetUserMFAPreference",
  body: Record<string, unknown>,
  fetchImpl: FetchLike,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(`https://cognito-idp.${config.cognitoRegion}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const raw = typeof json.__type === "string" ? json.__type : "UnknownError";
    throw new CognitoError(raw.split("#").pop() ?? raw, response.status);
  }
  return json;
}

function readTokens(json: Record<string, unknown>): Tokens {
  const result = json.AuthenticationResult as Record<string, unknown> | undefined;
  const accessToken = result?.AccessToken;
  if (typeof accessToken !== "string") {
    if (json.ChallengeName === "SOFTWARE_TOKEN_MFA" && typeof json.Session === "string") {
      const params = json.ChallengeParameters as Record<string, unknown> | undefined;
      const userId = params?.USER_ID_FOR_SRP;
      throw new CognitoMfaChallenge(json.Session, typeof userId === "string" ? userId : undefined);
    }
    throw new CognitoError(
      typeof json.ChallengeName === "string" ? `Challenge:${json.ChallengeName}` : "NoTokens",
      400,
    );
  }
  return {
    accessToken,
    refreshToken: typeof result?.RefreshToken === "string" ? result.RefreshToken : undefined,
  };
}

/** `InitiateAuth` con `USER_PASSWORD_AUTH`: el `SECRET_HASH` se calcula con el correo. */
export async function signInWithPassword(
  config: BffConfig,
  email: string,
  password: string,
  fetchImpl: FetchLike = fetch,
): Promise<Tokens & { refreshToken: string; username: string }> {
  const json = await call(
    config,
    "InitiateAuth",
    {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: config.cognitoClientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash(email, config.cognitoClientId, config.cognitoClientSecret),
      },
    },
    fetchImpl,
  );
  const tokens = readTokens(json);
  const username = decodeClaims(tokens.accessToken)?.username;
  if (!tokens.refreshToken || typeof username !== "string") throw new CognitoError("NoTokens", 400);
  return { ...tokens, refreshToken: tokens.refreshToken, username };
}

/**
 * `RespondToAuthChallenge` con `SOFTWARE_TOKEN_MFA`: completa el inicio de sesión con el código
 * TOTP. El `SECRET_HASH` se calcula con el mismo `USERNAME` que se envía: el `username` interno
 * que dio el desafío o, si no vino, el correo.
 */
export async function respondToMfaChallenge(
  config: BffConfig,
  input: { email: string; username?: string; code: string; session: string },
  fetchImpl: FetchLike = fetch,
): Promise<Tokens & { refreshToken: string; username: string }> {
  const who = input.username ?? input.email;
  const json = await call(
    config,
    "RespondToAuthChallenge",
    {
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      ClientId: config.cognitoClientId,
      Session: input.session,
      ChallengeResponses: {
        USERNAME: who,
        SOFTWARE_TOKEN_MFA_CODE: input.code,
        SECRET_HASH: secretHash(who, config.cognitoClientId, config.cognitoClientSecret),
      },
    },
    fetchImpl,
  );
  const tokens = readTokens(json);
  const username = decodeClaims(tokens.accessToken)?.username;
  if (!tokens.refreshToken || typeof username !== "string") throw new CognitoError("NoTokens", 400);
  return { ...tokens, refreshToken: tokens.refreshToken, username };
}

/** `AssociateSoftwareToken` (RF-85): devuelve la clave TOTP (`SecretCode`) de la cuenta. */
export async function associateSoftwareToken(
  config: BffConfig,
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const json = await call(
    config,
    "AssociateSoftwareToken",
    { AccessToken: accessToken },
    fetchImpl,
  );
  if (typeof json.SecretCode !== "string") throw new CognitoError("NoSecret", 400);
  return json.SecretCode;
}

/**
 * `VerifySoftwareToken`: comprueba un código TOTP de 6 dígitos. Un código incorrecto responde
 * `Status: ERROR` o `EnableSoftwareTokenMFAException`; ambos se tratan como `CodeMismatchException`.
 */
export async function verifySoftwareToken(
  config: BffConfig,
  accessToken: string,
  code: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  try {
    const json = await call(
      config,
      "VerifySoftwareToken",
      { AccessToken: accessToken, UserCode: code, FriendlyDeviceName: "Hindama" },
      fetchImpl,
    );
    if (json.Status !== "SUCCESS") throw new CognitoError("CodeMismatchException", 400);
  } catch (error) {
    if (error instanceof CognitoError && error.type === "EnableSoftwareTokenMFAException")
      throw new CognitoError("CodeMismatchException", 400);
    throw error;
  }
}

/** `SetUserMFAPreference`: activa (y deja como preferido) o desactiva el TOTP de la cuenta. */
export async function setSoftwareTokenMfa(
  config: BffConfig,
  accessToken: string,
  enabled: boolean,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await call(
    config,
    "SetUserMFAPreference",
    {
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: { Enabled: enabled, PreferredMfa: enabled },
    },
    fetchImpl,
  );
}

/**
 * `InitiateAuth` con `REFRESH_TOKEN_AUTH`. El `SECRET_HASH` se calcula con el `username`
 * interno, no con el correo (trampa de la sección 2.4).
 */
export async function refreshTokens(
  config: BffConfig,
  username: string,
  refreshToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<Tokens> {
  const json = await call(
    config,
    "InitiateAuth",
    {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: config.cognitoClientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        SECRET_HASH: secretHash(username, config.cognitoClientId, config.cognitoClientSecret),
      },
    },
    fetchImpl,
  );
  return readTokens(json);
}

/** `RevokeToken` con el refresh token (RF-04). Es la única llamada que envía el secreto tal cual. */
export async function revokeRefreshToken(
  config: BffConfig,
  refreshToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await call(
    config,
    "RevokeToken",
    {
      Token: refreshToken,
      ClientId: config.cognitoClientId,
      ClientSecret: config.cognitoClientSecret,
    },
    fetchImpl,
  );
}

/** `SignUp` (RF-01): `Username` = correo; atributos obligatorios `email` y `name` (guía §2.2). */
export async function signUp(
  config: BffConfig,
  input: { email: string; name: string; password: string },
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await call(
    config,
    "SignUp",
    {
      ClientId: config.cognitoClientId,
      SecretHash: secretHash(input.email, config.cognitoClientId, config.cognitoClientSecret),
      Username: input.email,
      Password: input.password,
      UserAttributes: [
        { Name: "email", Value: input.email },
        { Name: "name", Value: input.name },
      ],
    },
    fetchImpl,
  );
}

/** `ConfirmSignUp` (RF-02): código de 6 dígitos enviado al correo. */
export async function confirmSignUp(
  config: BffConfig,
  email: string,
  code: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await call(
    config,
    "ConfirmSignUp",
    {
      ClientId: config.cognitoClientId,
      SecretHash: secretHash(email, config.cognitoClientId, config.cognitoClientSecret),
      Username: email,
      ConfirmationCode: code,
    },
    fetchImpl,
  );
}

/** `ResendConfirmationCode` (RF-02). El pool envía como máximo 50 correos al día (guía §2.2). */
export async function resendConfirmationCode(
  config: BffConfig,
  email: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await call(
    config,
    "ResendConfirmationCode",
    {
      ClientId: config.cognitoClientId,
      SecretHash: secretHash(email, config.cognitoClientId, config.cognitoClientSecret),
      Username: email,
    },
    fetchImpl,
  );
}

/** `ForgotPassword` (RF-05): envía un código al correo verificado. */
export async function forgotPassword(
  config: BffConfig,
  email: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await call(
    config,
    "ForgotPassword",
    {
      ClientId: config.cognitoClientId,
      SecretHash: secretHash(email, config.cognitoClientId, config.cognitoClientSecret),
      Username: email,
    },
    fetchImpl,
  );
}

/** `ConfirmForgotPassword` (RF-05): código y contraseña nueva en la misma llamada. */
export async function confirmForgotPassword(
  config: BffConfig,
  input: { email: string; code: string; password: string },
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  await call(
    config,
    "ConfirmForgotPassword",
    {
      ClientId: config.cognitoClientId,
      SecretHash: secretHash(input.email, config.cognitoClientId, config.cognitoClientSecret),
      Username: input.email,
      ConfirmationCode: input.code,
      Password: input.password,
    },
    fetchImpl,
  );
}
