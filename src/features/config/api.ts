"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  contractFileError,
  contractPageSchema,
  contractUrlSchema,
  contractVersionSchema,
  operationPageSchema,
  operationSchema,
  operationUpdateSchema,
  policyBulkResultSchema,
  policyBulkUpdateSchema,
  type ContractVersion,
  type Operation,
  type OperationUpdate,
  type PolicyBulkUpdate,
} from "@/lib/api/schemas/contracts";
import type { Schemas } from "@/lib/api/types";
import {
  verificationRequestSchema,
  verificationSchema,
  type Verification,
  type VerificationRequest,
} from "@/lib/api/schemas/verification";
import { ApiError, type HttpClient } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { projectKey, projectPath, PROJECTS_KEY } from "@/features/projects/api";

type HttpMethod = Schemas["HttpMethod"];

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

export const contractsKey = (id: string) => [...projectKey(id), "contracts"] as const;
export const operationsKey = (id: string) => [...projectKey(id), "operations"] as const;

/** `listContracts` (V-20). */
export function useContracts(id: string, page = 1, pageSize = 20) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...contractsKey(id), "list", { page, pageSize }],
    queryFn: async ({ signal }) =>
      (
        await http.read(`${projectPath(id)}/contracts`, contractPageSchema, {
          query: { page, page_size: pageSize },
          signal,
        })
      ).data,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** `getContract` (V-19, V-20): una versión con sus avisos y cambios. */
export function useContract(id: string, contractId: string | null | undefined) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...contractsKey(id), "detail", contractId],
    queryFn: async ({ signal }) =>
      (
        await http.read(
          `${projectPath(id)}/contracts/${encodeURIComponent(contractId ?? "")}`,
          contractVersionSchema,
          { signal },
        )
      ).data,
    enabled: Boolean(contractId),
    retry: false,
  });
}

export type ContractSource = { file: File } | { url: string };

/**
 * `importContract` (V-19): `multipart/form-data` con exactamente uno de `file` o `url`. Del
 * archivo se comprueba solo el tamaño y el tipo; el contenido lo analiza la API.
 */
export async function importContract(http: HttpClient, id: string, source: ContractSource) {
  const form = new FormData();
  if ("file" in source) {
    const error = contractFileError(source.file);
    if (error)
      throw new ApiError({ status: 422, code: "validation.failed", fields: { file: [error] } });
    form.set("file", source.file, source.file.name);
  } else {
    form.set("url", contractUrlSchema.parse(source.url));
  }
  return http.post<ContractVersion>(`${projectPath(id)}/contracts`, {
    body: form,
    schema: contractVersionSchema,
  });
}

/** Tras importar: el proyecto, sus versiones y sus operaciones cambian. */
export function useAfterImport(id: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: projectKey(id) });
    void client.invalidateQueries({ queryKey: [...PROJECTS_KEY, "list"] });
  };
}

/** `listOperations` (V-19, V-24): una página, con el filtro de método de la API. */
export function useOperations(
  id: string,
  {
    page = 1,
    pageSize = 100,
    method,
    includeRetired = false,
    enabled = true,
  }: {
    page?: number;
    pageSize?: number;
    method?: HttpMethod;
    includeRetired?: boolean;
    enabled?: boolean;
  } = {},
) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...operationsKey(id), { page, pageSize, method, includeRetired }],
    queryFn: async ({ signal }) =>
      (
        await http.read(`${projectPath(id)}/operations`, operationPageSchema, {
          query: {
            page,
            page_size: pageSize,
            method,
            include_retired: includeRetired ? "true" : undefined,
          },
          signal,
        })
      ).data,
    placeholderData: keepPreviousData,
    enabled,
    retry: false,
  });
}

/** `updateOperation` (V-24). */
export async function updateOperation(
  http: HttpClient,
  id: string,
  operationId: string,
  input: OperationUpdate,
): Promise<Operation> {
  const body = operationUpdateSchema.parse(input);
  return (
    await http.patch<Operation>(
      `${projectPath(id)}/operations/${encodeURIComponent(operationId)}`,
      { body, schema: operationSchema },
    )
  ).data;
}

/** `applyPolicy` (V-24): una plantilla para varias operaciones. */
export async function applyPolicy(http: HttpClient, id: string, input: PolicyBulkUpdate) {
  const body = policyBulkUpdateSchema.parse(input);
  return (
    await http.post<{ items: Operation[] }>(`${projectPath(id)}/policy`, {
      body,
      schema: policyBulkResultSchema,
    })
  ).data;
}

/** Tras cambiar la política: las operaciones y el proyecto (`policy_unconfirmed`). */
export function useAfterPolicy(id: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: operationsKey(id) });
    void client.invalidateQueries({ queryKey: projectKey(id), exact: true });
  };
}
