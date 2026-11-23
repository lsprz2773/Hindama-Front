"use client";

import { useQuery } from "@tanstack/react-query";
import type { HttpClient } from "@/lib/http";
import { meSchema } from "@/lib/api/schemas/account";
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
