import { z } from "zod";
import type { Schemas } from "../types";
import { assertType, FIELD_CODES, type Equal } from "../zod";
import {
  endReasonSchema,
  moduleSchema,
  pageSchema,
  runStatusSchema,
  verdictSchema,
} from "./common";
import { operationRefSchema } from "./contracts";
import {
  contractVersionSummarySchema,
  queryInt,
  runSummarySchema,
  severityCountSchema,
} from "./projects";

/**
 * Ejecuciones: `listRuns`, `createRun`, `getRun`, `cancelRun`, `rerunRun`, `streamRunEvents` y
 * `listRunResults` (V-16, V-25 a V-28).
 */

/** Parámetro de consulta repetible (`?status=a&status=b`): uno o varios valores sin repetir. */
export function queryList<T extends z.ZodType<string, string>>(item: T, max: number) {
  return z
    .union([item, z.array(item)])
    .transform((value): z.output<T>[] => (Array.isArray(value) ? value : [value]))
    .superRefine((list, ctx) => {
      if (list.length > max) ctx.addIssue({ code: "custom", message: FIELD_CODES.length });
      else if (new Set(list).size !== list.length)
        ctx.addIssue({ code: "custom", message: FIELD_CODES.format });
    });
}

export const runLimitsSchema = z.object({
  requests_per_second: z.number().int(),
  concurrency: z.number().int(),
  max_requests: z.number().int(),
  max_duration_minutes: z.number().int(),
});
assertType<Equal<z.output<typeof runLimitsSchema>, Schemas["RunLimits"]>>();
export type RunLimits = z.output<typeof runLimitsSchema>;

export const runProgressSchema = z.object({
  status: runStatusSchema,
  current_module: moduleSchema.nullable(),
  requests_sent: z.number().int().min(0),
  cells_planned: z.number().int().min(0),
  cells_evaluated: z.number().int().min(0),
  percent: z.number().int().min(0).max(100),
  findings_by_severity: severityCountSchema,
  updated_at: z.string(),
});
assertType<Equal<z.output<typeof runProgressSchema>, Schemas["RunProgress"]>>();
export type RunProgress = z.output<typeof runProgressSchema>;

/** Un recurso que la plataforma creó y no pudo borrar: el analista lo borra a mano (CU-23 E1). */
export const createdResourceFailureSchema = z.object({
  operation_id: z.string(),
  /** Ruta relativa a la URL base del proyecto (`/wishlist/wish-7`). */
  location: z.string(),
  /** `status_NNN`, `no_answer`, `no_identifier`, `budget_exhausted`, `not_deleted`, `run_interrupted`. */
  last_error: z.string().nullable(),
});
assertType<
  Equal<z.output<typeof createdResourceFailureSchema>, Schemas["CreatedResourceFailure"]>
>();
export type CreatedResourceFailure = z.output<typeof createdResourceFailureSchema>;

export const createdResourceCountSchema = z.object({
  pending: z.number().int().min(0),
  deleted: z.number().int().min(0),
  failed: z.number().int().min(0),
  failed_items: z.array(createdResourceFailureSchema),
});
assertType<Equal<z.output<typeof createdResourceCountSchema>, Schemas["CreatedResourceCount"]>>();

export const runSchema = z.object({
  id: z.string(),
  number: z.number().int().min(1),
  status: runStatusSchema,
  end_reason: endReasonSchema.nullable(),
  modules: z.array(moduleSchema),
  limits: runLimitsSchema,
  risk_confirmed: z.boolean(),
  contract_version: contractVersionSummarySchema.nullable(),
  source_run_id: z.string().nullable(),
  progress: runProgressSchema,
  created_resources: createdResourceCountSchema,
  cancel_requested_at: z.string().nullable(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
assertType<Equal<z.output<typeof runSchema>, Schemas["Run"]>>();
export type Run = z.output<typeof runSchema>;

export const runPageSchema = pageSchema(runSummarySchema);
assertType<Equal<z.output<typeof runPageSchema>, Schemas["RunPage"]>>();
export type RunPage = z.output<typeof runPageSchema>;

export const listRunsQuerySchema = z.strictObject({
  page: queryInt(1, 10000).optional(),
  page_size: queryInt(1, 100).optional(),
  status: queryList(runStatusSchema, 5).optional(),
});

const limitInput = (max: number) =>
  z
    .number({ error: FIELD_CODES.format })
    .int({ message: FIELD_CODES.format })
    .min(1, { message: FIELD_CODES.length })
    .max(max, { message: FIELD_CODES.length });

export const runLimitsInputSchema = z.strictObject({
  requests_per_second: limitInput(20).optional(),
  concurrency: limitInput(5).optional(),
  max_requests: limitInput(5000).optional(),
  max_duration_minutes: limitInput(30).optional(),
});
// El contrato da valores por defecto: en la entrada esos campos son opcionales.
assertType<Equal<z.output<typeof runLimitsInputSchema>, Partial<Schemas["RunLimitsInput"]>>>();

export const runCreateSchema = z.strictObject({
  modules: z
    .array(moduleSchema)
    .min(1, { message: FIELD_CODES.required })
    .max(7, { message: FIELD_CODES.length })
    .refine((list) => new Set(list).size === list.length, { message: FIELD_CODES.format }),
  limits: runLimitsInputSchema.optional(),
  confirm_risk: z.boolean().optional(),
});
export type RunCreate = z.output<typeof runCreateSchema>;
assertType<
  Equal<
    RunCreate,
    {
      modules: Schemas["Module"][];
      limits?: Partial<Schemas["RunLimitsInput"]>;
      confirm_risk?: boolean;
    }
  >
>();

export const runRerunSchema = z.strictObject({ confirm_risk: z.boolean().optional() });
export type RunRerun = z.output<typeof runRerunSchema>;
assertType<Equal<RunRerun, Partial<Schemas["RunRerun"]>>>();

/** Cancelar no lleva cuerpo; el BFF acepta solo `{}` o nada. */
export const emptyBodySchema = z.strictObject({});

export const identityRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  deleted: z.boolean(),
});
assertType<Equal<z.output<typeof identityRefSchema>, Schemas["IdentityRef"]>>();

export const resultSchema = z.object({
  module: moduleSchema,
  operation: operationRefSchema.nullable(),
  identity: identityRefSchema,
  expected: z.string(),
  observed: z.string(),
  verdict: verdictSchema,
  evaluated_at: z.string(),
});
assertType<Equal<z.output<typeof resultSchema>, Schemas["Result"]>>();
export type Result = z.output<typeof resultSchema>;

export const resultPageSchema = pageSchema(resultSchema);
assertType<Equal<z.output<typeof resultPageSchema>, Schemas["ResultPage"]>>();
export type ResultPage = z.output<typeof resultPageSchema>;

export const listRunResultsQuerySchema = z.strictObject({
  page: queryInt(1, 10000).optional(),
  page_size: queryInt(1, 500).optional(),
  module: queryList(moduleSchema, 7).optional(),
  verdict: queryList(verdictSchema, 4).optional(),
  identity_id: z.uuid({ message: FIELD_CODES.format }).optional(),
  operation_id: z.uuid({ message: FIELD_CODES.format }).optional(),
});

/** Eventos del stream de progreso (`streamRunEvents`). */
export const runEventSchemas = {
  snapshot: runSchema,
  progress: runProgressSchema,
  end: runSchema,
} as const;
