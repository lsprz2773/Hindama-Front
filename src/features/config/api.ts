"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  verificationRequestSchema,
  verificationSchema,
  type Verification,
  type VerificationRequest,
} from "@/lib/api/schemas/verification";
import type { HttpClient } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { projectKey, projectPath, PROJECTS_KEY } from "@/features/projects/api";

/** Consultas de la configuración de un proyecto (fase 4), colgadas de la clave del proyecto. */
export const verificationKey = (id: string) => [...projectKey(id), "verification"] as const;

/** `getVerification` (V-18). */
export function useVerification(id: string) {
  const http = useHttpClient();
  return useQuery({
    queryKey: verificationKey(id),
    queryFn: async ({ signal }) =>
      (await http.read(`${projectPath(id)}/verification`, verificationSchema, { signal })).data,
    retry: false,
  });
}

/** `verifyOwnership` (V-18): síncrona, hasta 20 s. Un 422 trae el motivo en `code` y `found`. */
export async function verifyOwnership(
  http: HttpClient,
  id: string,
  input: VerificationRequest,
): Promise<Verification> {
  const body = verificationRequestSchema.parse(input);
  return (
    await http.post<Verification>(`${projectPath(id)}/verification`, {
      body,
      schema: verificationSchema,
    })
  ).data;
}

/** Tras verificar: guarda el resultado y vuelve a pedir el proyecto y la lista. */
export function useAfterVerification(id: string) {
  const client = useQueryClient();
  return (verification: Verification) => {
    client.setQueryData(verificationKey(id), verification);
    void client.invalidateQueries({ queryKey: projectKey(id), exact: true });
    void client.invalidateQueries({ queryKey: [...PROJECTS_KEY, "list"] });
  };
}
