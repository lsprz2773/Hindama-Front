import { z } from "zod";
import type { Schemas } from "../types";
import { assertType, FIELD_CODES, zText, type Equal } from "../zod";
import { httpMethodSchema, moduleSchema, pageSchema } from "./common";
import { operationRefSchema } from "./contracts";
import { queryInt } from "./projects";
import { identityRefSchema, queryList } from "./runs";

/**
 * Hallazgos: `listFindings`, `getFinding`, `listFindingOccurrences`, `dismissFinding` y
 * `revertDismissal` (V-27, V-29, V-30). La evidencia viene de la API del analista: se muestra
 * siempre como texto.
 */

export const severitySchema = z.enum(["critical", "high", "medium", "low", "info"]);
assertType<Equal<z.output<typeof severitySchema>, Schemas["Severity"]>>();
export type Severity = z.output<typeof severitySchema>;

export const findingStatusSchema = z.enum([
  "new",
  "persistent",
  "resolved",
  "regression",
  "accepted_risk",
]);
assertType<Equal<z.output<typeof findingStatusSchema>, Schemas["FindingStatus"]>>();
export type FindingStatus = z.output<typeof findingStatusSchema>;

export const OPEN_STATUSES = ["new", "persistent", "regression"] as const;

export const dismissalReasonSchema = z.enum(["accepted_risk", "false_positive"]);
assertType<Equal<z.output<typeof dismissalReasonSchema>, Schemas["DismissalReason"]>>();
export type DismissalReason = z.output<typeof dismissalReasonSchema>;

export const runRefSchema = z.object({ id: z.string(), number: z.number().int().min(1) });
assertType<Equal<z.output<typeof runRefSchema>, Schemas["RunRef"]>>();

export const findingSummarySchema = z.object({
  id: z.string(),
  module: moduleSchema,
  finding_type: z.string(),
  title: z.string(),
  severity: severitySchema,
  owasp_category: z.string(),
  cwe: z.string().nullable(),
  status: findingStatusSchema,
  operation: operationRefSchema.nullable(),
  identity: identityRefSchema,
  detected_at: z.string(),
  last_detected_at: z.string(),
  resolved_at: z.string().nullable(),
  first_run: runRefSchema,
  last_run: runRefSchema,
});
assertType<Equal<z.output<typeof findingSummarySchema>, Schemas["FindingSummary"]>>();
export type FindingSummary = z.output<typeof findingSummarySchema>;

export const findingPageSchema = pageSchema(findingSummarySchema);
assertType<Equal<z.output<typeof findingPageSchema>, Schemas["FindingPage"]>>();
export type FindingPage = z.output<typeof findingPageSchema>;

export const evidenceSchema = z.object({
  request: z.object({
    method: httpMethodSchema,
    url: z.string(),
    headers: z.record(z.string(), z.string()),
    body: z.string().nullable(),
  }),
  response: z.object({
    status_code: z.number().int().min(100).max(599),
    headers: z.record(z.string(), z.string()),
    body: z.string(),
    body_truncated: z.boolean(),
  }),
  context: z.record(z.string(), z.unknown()),
});
assertType<Equal<z.output<typeof evidenceSchema>, Schemas["Evidence"]>>();
export type Evidence = z.output<typeof evidenceSchema>;

export const findingOccurrenceSchema = z.object({
  run: runRefSchema,
  severity: severitySchema,
  explanation: z.string(),
  evidence: evidenceSchema,
  detected_at: z.string(),
});
assertType<Equal<z.output<typeof findingOccurrenceSchema>, Schemas["FindingOccurrence"]>>();
export type FindingOccurrence = z.output<typeof findingOccurrenceSchema>;

export const findingOccurrencePageSchema = pageSchema(findingOccurrenceSchema);
assertType<Equal<z.output<typeof findingOccurrencePageSchema>, Schemas["FindingOccurrencePage"]>>();

export const findingEventSchema = z.object({
  from_status: findingStatusSchema.nullable(),
  to_status: findingStatusSchema,
  reason: z.enum([
    "detected",
    "not_detected",
    "regression",
    "accepted",
    "false_positive",
    "reverted",
    "identity_deleted",
    "operation_retired",
  ]),
  run: runRefSchema.nullable(),
  justification: z.string().nullable(),
  occurred_at: z.string(),
});
assertType<Equal<z.output<typeof findingEventSchema>, Schemas["FindingEvent"]>>();
export type FindingEvent = z.output<typeof findingEventSchema>;

export const findingSchema = findingSummarySchema.extend({
  recommendation: z.string(),
  dismissal: z
    .object({ reason: dismissalReasonSchema, justification: z.string(), dismissed_at: z.string() })
    .nullable(),
  resolution_reason: z.enum(["not_detected", "identity_deleted", "operation_retired"]).nullable(),
  last_occurrence: findingOccurrenceSchema,
  history: z.array(findingEventSchema),
});
assertType<Equal<z.output<typeof findingSchema>, Schemas["Finding"]>>();
export type Finding = z.output<typeof findingSchema>;

export const listFindingsQuerySchema = z.strictObject({
  page: queryInt(1, 10000).optional(),
  page_size: queryInt(1, 100).optional(),
  module: queryList(moduleSchema, 7).optional(),
  severity: queryList(severitySchema, 5).optional(),
  status: queryList(findingStatusSchema, 5).optional(),
  run_id: z.uuid({ message: FIELD_CODES.format }).optional(),
  identity_id: z.uuid({ message: FIELD_CODES.format }).optional(),
  operation_id: z.uuid({ message: FIELD_CODES.format }).optional(),
});

/** `exportFindings` (RF-77): los mismos filtros que `listFindings`, sin paginar. */
export const exportFindingsQuerySchema = listFindingsQuerySchema.omit({
  page: true,
  page_size: true,
});

export const listOccurrencesQuerySchema = z.strictObject({
  page: queryInt(1, 10000).optional(),
  page_size: queryInt(1, 20).optional(),
});

/** Justificación (RN-09): recortada, NFC, 1 a 2000 caracteres; admite tabulador y saltos de línea. */
const justification = zText({ min: 1, max: 2000, multiline: true });

export const dismissalCreateSchema = z.strictObject({
  reason: dismissalReasonSchema,
  justification,
});
export type DismissalCreate = z.output<typeof dismissalCreateSchema>;
assertType<Equal<DismissalCreate, Schemas["DismissalCreate"]>>();
