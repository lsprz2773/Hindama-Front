/**
 * Servicio de autenticación.
 *
 * TODO(api): todavía no hay conexión con la API. Estas funciones simulan la
 * respuesta para poder construir y probar las vistas; al conectar el BFF se
 * reemplazan por llamadas con `useHttpClient()` y conservan estas firmas.
 */

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
}

const SIMULATED_LATENCY_MS = 600;

function wait(ms = SIMULATED_LATENCY_MS) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Resultado de iniciar sesión; el 2FA lo decide la API según la cuenta. */
export type SignInResult = { next: "projects" } | { next: "two-factor" } | { next: "verify-email" };

export async function signIn(input: SignInInput): Promise<SignInResult> {
  void input;
  await wait();
  return { next: "projects" };
}

export async function signUp(input: SignUpInput): Promise<void> {
  void input;
  await wait();
}

export async function verifyEmail(input: { email: string; code: string }): Promise<void> {
  void input;
  await wait();
}

export async function resendVerificationCode(email: string): Promise<void> {
  void email;
  await wait(300);
}

export async function requestPasswordReset(email: string): Promise<void> {
  void email;
  await wait();
}

export async function confirmResetCode(input: { email: string; code: string }): Promise<void> {
  void input;
  await wait();
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<void> {
  void input;
  await wait();
}
