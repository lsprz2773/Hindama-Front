import { signInResultSchema, type mfaCodeSchema } from "@/lib/api/schemas/auth";
import type { z } from "zod";
import { setCsrfToken } from "@/lib/http/browser";
import type { HttpClient } from "@/lib/http";

/**
 * Acceso por el BFF (`/api/auth/*`), que llama a Cognito desde el servidor (guía del frontend
 * §2.3). El navegador nunca ve tokens: el inicio de sesión deja la cookie cifrada y devuelve el
 * token anti-CSRF y el rol de `GET /me`, que solo elige la pantalla inicial (guía §2.5).
 */

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

/**
 * A dónde sigue la persona tras el correo y la contraseña o tras el código: al segundo factor
 * (`two-factor`: Cognito pide el código TOTP), a configurarlo (`setup-two-factor`: un administrador
 * sin él, RF-86) o a su pantalla inicial.
 */
export type SignInResult =
  { next: "projects" } | { next: "admin" } | { next: "two-factor" } | { next: "setup-two-factor" };

function resolveSignIn(data: unknown): SignInResult {
  const result = signInResultSchema.parse(data);
  if ("mfa_required" in result) return { next: "two-factor" };
  setCsrfToken(result.csrf_token);
  if (result.role !== "admin") return { next: "projects" };
  return result.mfa_enabled === false ? { next: "setup-two-factor" } : { next: "admin" };
}

export async function signIn(http: HttpClient, input: SignInInput): Promise<SignInResult> {
  const { data } = await http.post<unknown>("/auth/sign-in", {
    body: input,
    schema: signInResultSchema,
  });
  return resolveSignIn(data);
}

/** V-05: completa el inicio de sesión con el código TOTP (`RespondToAuthChallenge`). */
export async function verifySignInCode(
  http: HttpClient,
  code: z.output<typeof mfaCodeSchema>["code"],
): Promise<SignInResult> {
  const { data } = await http.post<unknown>("/auth/mfa/challenge", {
    body: { code },
    schema: signInResultSchema,
  });
  return resolveSignIn(data);
}

export async function signUp(http: HttpClient, input: SignUpInput): Promise<void> {
  await http.post("/auth/sign-up", { body: input });
}

export async function verifyEmail(
  http: HttpClient,
  input: { email: string; code: string },
): Promise<void> {
  await http.post("/auth/sign-up/confirm", { body: input });
}

export async function resendVerificationCode(http: HttpClient, email: string): Promise<void> {
  await http.post("/auth/sign-up/resend", { body: { email } });
}

export async function requestPasswordReset(http: HttpClient, email: string): Promise<void> {
  await http.post("/auth/password/forgot", { body: { email } });
}

/** Cognito valida el código y la contraseña nueva en la misma llamada (`ConfirmForgotPassword`). */
export async function resetPassword(
  http: HttpClient,
  input: { email: string; code: string; password: string },
): Promise<void> {
  await http.post("/auth/password/reset", { body: input });
}
