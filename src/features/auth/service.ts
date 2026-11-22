import { signInResultSchema } from "@/lib/api/schemas/auth";
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

export type SignInResult = { next: "projects" } | { next: "admin" };

export async function signIn(http: HttpClient, input: SignInInput): Promise<SignInResult> {
  const { data } = await http.post<unknown>("/auth/sign-in", {
    body: input,
    schema: signInResultSchema,
  });
  const result = signInResultSchema.parse(data);
  setCsrfToken(result.csrf_token);
  return result.role === "admin" ? { next: "admin" } : { next: "projects" };
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
