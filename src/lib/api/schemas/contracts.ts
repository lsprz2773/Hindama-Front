import { z } from "zod";
import type { Schemas } from "../types";
import { assertType, FIELD_CODES, zText, type Equal } from "../zod";
import { httpMethodSchema, pageSchema, warningSchema } from "./common";
import { contractVersionSummarySchema, queryInt, zBaseUrl } from "./projects";

/**
 * Contrato del proyecto y operaciones: `importContract`, `listContracts`, `getContract`,
 * `listOperations`, `updateOperation` y `applyPolicy` (V-19, V-20 y V-24). Los textos que vienen
 * del documento importado (`api_title`, `summary`, `path`…) no son confiables: solo se muestran
 * como texto.
 */

export const operationRefSchema = z.object({
  id: z.string(),
  method: httpMethodSchema,
  path: z.string(),
});
assertType<Equal<z.output<typeof operationRefSchema>, Schemas["OperationRef"]>>();

export const contractChangesSchema = z.object({
  previous_version: z.number().int(),
  added: z.array(operationRefSchema),
  modified: z.array(operationRefSchema),
  removed: z.array(operationRefSchema),
});
assertType<Equal<z.output<typeof contractChangesSchema>, Schemas["ContractChanges"]>>();

export const contractVersionSchema = z.object({
  id: z.string(),
  number: z.number().int().min(1),
  source: z.enum(["file", "url"]),
  openapi_version: z.string(),
  operation_count: z.number().int().min(0),
  imported_at: z.string(),
  source_url: z.string().nullable(),
  file_name: z.string().nullable(),
  format: z.enum(["json", "yaml"]),
  api_title: z.string().nullable(),
  sha256: z.string(),
  is_current: z.boolean(),
  warnings: z.array(warningSchema),
  changes: contractChangesSchema.nullable(),
});
assertType<Equal<z.output<typeof contractVersionSchema>, Schemas["ContractVersion"]>>();
export type ContractVersion = z.output<typeof contractVersionSchema>;

export const contractPageSchema = pageSchema(contractVersionSummarySchema);
assertType<Equal<z.output<typeof contractPageSchema>, Schemas["ContractPage"]>>();
export type ContractPage = z.output<typeof contractPageSchema>;

export const listContractsQuerySchema = z.strictObject({
  page: queryInt(1, 10000).optional(),
  page_size: queryInt(1, 100).optional(),
});

/** Importación (`ContractImport`): un documento de hasta 5 MB o una URL pública. */
export const CONTRACT_MAX_BYTES = 5 * 1024 * 1024;
export const CONTRACT_EXTENSIONS = [".json", ".yaml", ".yml"] as const;
export const CONTRACT_TYPES = [
  "",
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
  "text/plain",
  "application/octet-stream",
] as const;

/** Código de error del archivo según su tamaño y tipo (el contenido lo valida la API). */
export function contractFileError(file: { name: string; size: number; type: string }) {
  if (file.size === 0) return FIELD_CODES.required;
  if (file.size > CONTRACT_MAX_BYTES) return "contract.too_large";
  const name = file.name.toLowerCase();
  if (name.length > 255 || !CONTRACT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "contract.invalid_type";
  }
  if (!(CONTRACT_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    return "contract.invalid_type";
  }
  return null;
}

export const contractUrlSchema = zBaseUrl;

export const policySchema = z.enum([
  "public",
  "authenticated",
  "owner_only",
  "owner_or_admin",
  "admin_only",
]);
assertType<Equal<z.output<typeof policySchema>, Schemas["Policy"]>>();
export type Policy = z.output<typeof policySchema>;

export const parameterSchema = z.object({
  name: z.string(),
  location: z.enum(["path", "query", "header", "cookie"]),
  required: z.boolean(),
  type: z.string().nullable(),
});
assertType<Equal<z.output<typeof parameterSchema>, Schemas["Parameter"]>>();

export const requestBodySchema = z.object({
  required: z.boolean(),
  content_types: z.array(z.string()),
});
assertType<Equal<z.output<typeof requestBodySchema>, Schemas["RequestBody"]>>();

export const declaredSecuritySchema = z.object({
  scheme: z.string(),
  type: z.enum(["http_bearer", "http_basic", "api_key", "oauth2", "openid_connect", "other"]),
});
assertType<Equal<z.output<typeof declaredSecuritySchema>, Schemas["DeclaredSecurity"]>>();

export const resourceParameterSchema = z.object({
  name: z.string(),
  resource_type: z.string(),
});

/** Entrada de un parámetro de recurso: textos de 1 a 100 caracteres sin control. */
export const resourceParameterInputSchema = z.strictObject({
  name: zText({ min: 1, max: 100 }),
  resource_type: zText({ min: 1, max: 100 }),
});
assertType<Equal<z.output<typeof resourceParameterSchema>, Schemas["ResourceParameter"]>>();
assertType<Equal<z.output<typeof resourceParameterInputSchema>, Schemas["ResourceParameter"]>>();

export const operationSchema = z.object({
  id: z.string(),
  method: httpMethodSchema,
  path: z.string(),
  operation_id: z.string().nullable(),
  summary: z.string().nullable(),
  tags: z.array(z.string()),
  parameters: z.array(parameterSchema),
  body: requestBodySchema.nullable(),
  security: z.array(declaredSecuritySchema),
  retired_at: z.string().nullable(),
  suggested_policy: policySchema.nullable(),
  policy: policySchema.nullable(),
  owner_field: z.string().nullable(),
  confirmed_at: z.string().nullable(),
  modified_at: z.string().nullable(),
  resource_parameters: z.array(resourceParameterSchema),
  is_login_candidate: z.boolean(),
});
assertType<Equal<z.output<typeof operationSchema>, Schemas["Operation"]>>();
export type Operation = z.output<typeof operationSchema>;

export const operationPageSchema = pageSchema(operationSchema);
assertType<Equal<z.output<typeof operationPageSchema>, Schemas["OperationPage"]>>();
export type OperationPage = z.output<typeof operationPageSchema>;

export const listOperationsQuerySchema = z.strictObject({
  page: queryInt(1, 10000).optional(),
  page_size: queryInt(1, 500).optional(),
  include_retired: z.enum(["true", "false"]).optional(),
  method: httpMethodSchema.optional(),
});

const ownerField = zText({ min: 1, max: 200 });

export const operationUpdateSchema = z
  .strictObject({
    policy: policySchema.nullable().optional(),
    owner_field: ownerField.nullable().optional(),
    resource_parameters: z.array(resourceParameterInputSchema).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: FIELD_CODES.required });
export type OperationUpdate = z.output<typeof operationUpdateSchema>;
assertType<Equal<OperationUpdate, Schemas["OperationUpdate"]>>();

export const policyBulkUpdateSchema = z.strictObject({
  operation_ids: z
    .array(z.uuid({ message: FIELD_CODES.format }))
    .min(1, { message: FIELD_CODES.required })
    .max(500, { message: FIELD_CODES.length })
    .refine((ids) => new Set(ids).size === ids.length, { message: FIELD_CODES.format }),
  policy: policySchema,
  owner_field: ownerField.nullable().optional(),
});
export type PolicyBulkUpdate = z.output<typeof policyBulkUpdateSchema>;
assertType<Equal<PolicyBulkUpdate, Schemas["PolicyBulkUpdate"]>>();

export const policyBulkResultSchema = z.object({ items: z.array(operationSchema) });
assertType<Equal<z.output<typeof policyBulkResultSchema>, Schemas["PolicyBulkResult"]>>();
