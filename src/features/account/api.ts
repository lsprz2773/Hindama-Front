"use client";

import { useQuery } from "@tanstack/react-query";
import type { HttpClient } from "@/lib/http";
import { meSchema } from "@/lib/api/schemas/account";
import { mfaSetupResultSchema } from "@/lib/api/schemas/auth";
import { useHttpClient } from "@/lib/http/browser";
import { ME_KEY } from "@/lib/query/provider";

/** `getMe` por el BFF (`GET /api/me`). Lo comparten la barra lateral, el perfil y los términos. */
export function useMe() {
  const http = useHttpClient();
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async ({ signal }) => (await http.read("/me", meSchema, { signal })).data,
  });
}

/**
 * `deleteAccount` (C-14, CU-25): borra la cuenta, sus proyectos y la cuenta de Cognito. La
 * confirmación es el correo tal como lo escribió la persona. Con 204 el BFF ya borró la cookie.
 */
export async function deleteAccount(http: HttpClient, email: string) {
  await http.delete("/me", { query: { confirmation: email } });
}

/** V-10, V-11: pide a Cognito una clave TOTP nueva para la cuenta (`AssociateSoftwareToken`). */
export async function startTwoFactorSetup(http: HttpClient, signal?: AbortSignal) {
  const { data } = await http.post<unknown>("/auth/mfa/setup", {
    schema: mfaSetupResultSchema,
    signal,
  });
  return mfaSetupResultSchema.parse(data).secret;
}

/** V-10, V-11: confirma el primer código y deja el TOTP activo (`VerifySoftwareToken`). */
export async function confirmTwoFactor(http: HttpClient, code: string) {
  await http.post("/auth/mfa/verify", { body: { code } });
}

/** V-09 (RF-87): desactiva el TOTP con un código vigente. El administrador no puede. */
export async function disableTwoFactor(http: HttpClient, code: string) {
  await http.post("/auth/mfa/disable", { body: { code } });
}

/** `otpauth://` que lee la app de autenticación: correo como cuenta y «Hindama» como emisor. */
export function otpauthUri(email: string, secret: string): string {
  return `otpauth://totp/Hindama:${encodeURIComponent(email)}?secret=${secret}&issuer=Hindama`;
}

/** La clave en grupos de 4 para leerla y escribirla a mano. */
export function formatSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}
