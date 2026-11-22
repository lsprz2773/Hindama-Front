/**
 * Configuración del BFF, leída solo en el servidor. Ningún valor de aquí llega al navegador:
 * no se usa el prefijo `NEXT_PUBLIC_`.
 *
 * Variables (guía del frontend, sección 2.1; los secretos viven en SSM):
 * - `COGNITO_REGION`, `COGNITO_CLIENT_ID`: públicos.
 * - `COGNITO_CLIENT_SECRET`: secreto del cliente confidencial, leído de SSM.
 * - `HINDAMA_API_URL`: URL privada de la API de la plataforma.
 * - `HINDAMA_PUBLIC_ORIGIN`: origen público del frontend (`https://…`), para verificar `Origin`.
 * - `HINDAMA_SESSION_KEY_PARAMETER`: nombre del parámetro de SSM con la llave de la cookie, o
 *   `HINDAMA_SESSION_KEY` en desarrollo, copiada de SSM a `.env.local` (32 bytes en base64).
 */
export interface BffConfig {
  cognitoRegion: string;
  cognitoClientId: string;
  cognitoClientSecret: string;
  apiUrl: string;
  publicOrigin: string;
  sessionKeyParameter?: string;
  sessionKey?: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`[bff] Falta la variable de entorno ${name}.`);
  return value;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): BffConfig {
  return {
    cognitoRegion: required(env, "COGNITO_REGION"),
    cognitoClientId: required(env, "COGNITO_CLIENT_ID"),
    cognitoClientSecret: required(env, "COGNITO_CLIENT_SECRET"),
    apiUrl: required(env, "HINDAMA_API_URL").replace(/\/$/, ""),
    publicOrigin: new URL(required(env, "HINDAMA_PUBLIC_ORIGIN")).origin,
    sessionKeyParameter: env.HINDAMA_SESSION_KEY_PARAMETER || undefined,
    sessionKey: env.HINDAMA_SESSION_KEY || undefined,
  };
}

let cached: BffConfig | undefined;

export function getConfig(): BffConfig {
  cached ??= readConfig();
  return cached;
}
