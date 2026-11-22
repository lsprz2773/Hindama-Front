"use client";

import { useQuery } from "@tanstack/react-query";
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
