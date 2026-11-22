import { connection } from "next/server";
import { getConfig, type BffConfig } from "./config";
import type { FetchLike } from "./cognito";
import { getSessionKey } from "./session-key";

export interface BffDeps {
  config: BffConfig;
  key: Buffer;
  /** `fetch` hacia la API de la plataforma. */
  apiFetch: FetchLike;
  /** `fetch` hacia Cognito. */
  cognitoFetch: FetchLike;
  now: () => number;
}

export async function getDeps(): Promise<BffDeps> {
  // Las rutas del BFF dependen de la petición: nunca se prerenderizan en el build.
  await connection();
  const config = getConfig();
  return {
    config,
    key: await getSessionKey(config),
    apiFetch: fetch,
    cognitoFetch: fetch,
    now: Date.now,
  };
}
