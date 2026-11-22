import { z } from "zod";
import type { Operations, Schemas } from "../types";
import { assertType, FIELD_CODES, zText, type Equal } from "../zod";
import {
  endReasonSchema,
  moduleSchema,
  pageSchema,
  runStatusSchema,
  verificationStatusSchema,
  warningSchema,
} from "./common";

/** Proyectos: `listProjects`, `createProject`, `getProject`, `updateProject`, `deleteProject`. */

export const severityCountSchema = z.object({
  critical: z.number().int().min(0),
  high: z.number().int().min(0),
  medium: z.number().int().min(0),
  low: z.number().int().min(0),
  info: z.number().int().min(0),
  total: z.number().int().min(0),
});
assertType<Equal<z.output<typeof severityCountSchema>, Schemas["SeverityCount"]>>();

export const contractVersionSummarySchema = z.object({
  id: z.string(),
  number: z.number().int(),
  source: z.enum(["file", "url"]),
  openapi_version: z.string(),
  operation_count: z.number().int().min(0),
  imported_at: z.string(),
});
assertType<
  Equal<z.output<typeof contractVersionSummarySchema>, Schemas["ContractVersionSummary"]>
>();

export const runSummarySchema = z.object({
  id: z.string(),
  number: z.number().int(),
  status: runStatusSchema,
  end_reason: endReasonSchema.nullable(),
  modules: z.array(moduleSchema),
  requests_sent: z.number().int().min(0),
  findings_by_severity: severityCountSchema,
  created_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
assertType<Equal<z.output<typeof runSummarySchema>, Schemas["RunSummary"]>>();

export const missingReasonSchema = z.enum([
  "project_not_verified",
  "no_contract",
  "insufficient_identities",
  "no_admin_identity",
  "no_resources",
  "policy_unconfirmed",
]);

export const moduleAvailabilitySchema = z.object({
  module: moduleSchema,
  risk: z.enum(["low", "medium", "high"]),
  available: z.boolean(),
  missing: z.array(missingReasonSchema),
});
assertType<Equal<z.output<typeof moduleAvailabilitySchema>, Schemas["ModuleAvailability"]>>();

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  base_url: z.string(),
  verification_status: verificationStatusSchema,
  concluded: z.boolean(),
  last_run_at: z.string().nullable(),
  open_findings: z.number().int().min(0),
  created_at: z.string(),
});
assertType<Equal<z.output<typeof projectSummarySchema>, Schemas["ProjectSummary"]>>();

export const projectPageSchema = pageSchema(projectSummarySchema);
assertType<Equal<z.output<typeof projectPageSchema>, Schemas["ProjectPage"]>>();

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  base_url: z.string(),
  host: z.string(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  concluded: z.boolean(),
  current_contract: contractVersionSummarySchema.nullable(),
  last_run: runSummarySchema.nullable(),
  open_findings_by_severity: severityCountSchema,
  modules: z.array(moduleAvailabilitySchema),
  warnings: z.array(warningSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
assertType<Equal<z.output<typeof projectSchema>, Schemas["Project"]>>();

export type ProjectSummary = z.output<typeof projectSummarySchema>;
export type ProjectPage = z.output<typeof projectPageSchema>;
export type Project = z.output<typeof projectSchema>;
export type ModuleAvailability = z.output<typeof moduleAvailabilitySchema>;
export type SeverityCount = z.output<typeof severityCountSchema>;

/* ---------- Entradas ---------- */

/**
 * URL base: `http` o `https`, sin usuario, contraseña ni fragmento (contrato, RF-11). Que el host
 * no sea privado ni de metadatos lo decide la API (`url.destination_not_allowed`).
 */
export const zBaseUrl = zText({ min: 1, max: 2048 }).superRefine((value, ctx) => {
  if (!value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "url.invalid_format" });
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    ctx.addIssue({ code: "custom", message: "url.scheme_not_allowed" });
  } else if (url.username || url.password || url.hash || value.includes("#") || !url.hostname) {
    ctx.addIssue({ code: "custom", message: "url.invalid_format" });
  }
});

const projectName = zText({ min: 1, max: 100 });
/** Descripción opcional: vacía se envía como `null`. */
const projectDescription = zText({ max: 500, multiline: true })
  .transform((value) => (value === "" ? null : value))
  .nullable();

export const projectCreateSchema = z.strictObject({
  name: projectName,
  description: projectDescription.optional(),
  base_url: zBaseUrl,
});

export const projectUpdateSchema = z
  .strictObject({
    name: projectName.optional(),
    description: projectDescription.optional(),
    base_url: zBaseUrl.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: FIELD_CODES.required });

export type ProjectCreate = z.output<typeof projectCreateSchema>;
export type ProjectUpdate = z.output<typeof projectUpdateSchema>;
assertType<Equal<ProjectCreate, Schemas["ProjectCreate"]>>();
assertType<Equal<ProjectUpdate, Schemas["ProjectUpdate"]>>();

/** Entero de la consulta (llega como texto) con sus límites del contrato. */
export function queryInt(min: number, max: number) {
  return z.coerce
    .number({ error: FIELD_CODES.format })
    .int({ message: FIELD_CODES.format })
    .min(min, { message: FIELD_CODES.length })
    .max(max, { message: FIELD_CODES.length });
}

export const projectSortSchema = z.enum([
  "created_at",
  "-created_at",
  "name",
  "-name",
  "last_run_at",
  "-last_run_at",
]);

export const listProjectsQuerySchema = z.strictObject({
  page: queryInt(1, 10_000).optional(),
  page_size: queryInt(1, 100).optional(),
  sort: projectSortSchema.optional(),
});
assertType<
  Equal<
    z.output<typeof listProjectsQuerySchema>,
    NonNullable<Operations["listProjects"]["parameters"]["query"]>
  >
>();

/** `confirmation` de `deleteProject`: el nombre exacto, sin recortar (lo compara la API). */
export const deleteProjectQuerySchema = z.strictObject({
  confirmation: zText({ min: 1, max: 100, raw: true }),
});
