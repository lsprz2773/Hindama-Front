import { createHmac } from "node:crypto";
import type { BffConfig } from "./config";
import { decodeClaims } from "./jwt";

/**
 * Llamadas a Cognito desde el servidor con el cliente confidencial (ADR-005, guía del
 * frontend secciones 2.3 y 2.4). Solo `USER_PASSWORD_AUTH` y `REFRESH_TOKEN_AUTH`. Ninguna
 * necesita credenciales de AWS: se autentican con el Client ID y el `SECRET_HASH`. El secreto
 * del cliente nunca sale del servidor. No se registran cuerpos ni tokens.
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

export interface Tokens {
  accessToken: string;
  /** Solo viene al iniciar sesión; la renovación conserva el anterior. */
  refreshToken?: string;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

async function call(
  config: BffConfig,
  action: "InitiateAuth" | "RevokeToken",
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
    // Un desafío (p. ej. `SOFTWARE_TOKEN_MFA`) llega con F-15; hoy el MFA está desactivado.
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
