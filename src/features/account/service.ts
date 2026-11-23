/**
 * Servicio de cuenta y segundo factor.
 *
 * TODO(api): sin conexión con la API todavía. Estas funciones simulan la respuesta para
 * construir y probar las vistas; al conectar el BFF conservan sus firmas.
 */

const LATENCY_MS = 500;
const wait = (ms = LATENCY_MS) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function confirmTwoFactor(code: string): Promise<void> {
  void code;
  await wait();
}

export async function disableTwoFactor(code: string): Promise<void> {
  void code;
  await wait();
}

export async function verifyLoginTwoFactor(input: { code: string; admin: boolean }): Promise<void> {
  void input;
  await wait();
}

export async function adminSignIn(input: { email: string; password: string }): Promise<void> {
  void input;
  await wait();
}

/** Clave TOTP de ejemplo; la API entregará la real junto con el QR (`otpauth://`). */
export const TOTP_SECRET_STUB = "JBSWY3DPEHPK3PXP";

export function formatSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}
