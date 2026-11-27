import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import type { BffConfig } from "./config";

/**
 * Llave AES-256 de la cookie de sesión (ADR-005). Vive en SSM Parameter Store, nunca en el
 * repositorio. Rotarla cierra todas las sesiones: las cookies cifradas con la anterior dejan
 * de poder descifrarse y se tratan como «sin sesión».
 */
export function parseSessionKey(encoded: string): Buffer {
  const key = Buffer.from(encoded.trim(), "base64");
  if (key.length !== 32) throw new Error("[bff] La llave de sesión debe tener 32 bytes en base64.");
  return key;
}

let pending: Promise<Buffer> | undefined;

export function getSessionKey(config: BffConfig): Promise<Buffer> {
  pending ??= (async () => {
    if (config.sessionKeyParameter) {
      const ssm = new SSMClient({ region: config.cognitoRegion });
      const { Parameter } = await ssm.send(
        new GetParameterCommand({ Name: config.sessionKeyParameter, WithDecryption: true }),
      );
      if (!Parameter?.Value)
        throw new Error("[bff] El parámetro de la llave de sesión está vacío.");
      return parseSessionKey(Parameter.Value);
    }
    if (config.sessionKey) return parseSessionKey(config.sessionKey);
    throw new Error(
      "[bff] Falta HINDAMA_SESSION_KEY_PARAMETER (SSM) o HINDAMA_SESSION_KEY (desarrollo).",
    );
  })().catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
