import { z } from "zod";
import type { Schemas } from "../types";
import { assertType, FIELD_CODES, zText, type Equal } from "../zod";
import { moduleSchema, pageSchema, verificationMethodSchema } from "./common";
import { dismissalReasonSchema } from "./findings";
import { queryInt, severityCountSchema } from "./projects";
import { queryList, runLimitsSchema } from "./runs";

/**
 * Administración: `listAuditLog` (V-34, F-14). Solo el administrador; el analista recibe 403 de la
 * API. Los registros no llevan credenciales, justificaciones, texto libre ni hosts en claro
 * (RF-83): `user_id` y `project_id` son identificadores opacos.
 */

export const AUDIT_ACTIONS = [
  "account_created",
  "account_deleted",
  "project_created",
  "project_deleted",
  "project_verified",
  "project_verification_lost",
  "identity_created",
  "identity_deleted",
  "run_launched",
  "run_cancelled",
  "finding_dismissed",
  "finding_dismissal_reverted",
  "destination_blocked",
] as const;
export const auditActionSchema = z.enum(AUDIT_ACTIONS);
assertType<Equal<z.output<typeof auditActionSchema>, Schemas["AuditAction"]>>();
export type AuditAction = z.output<typeof auditActionSchema>;

export const blockStageSchema = z.enum([
  "project_url",
  "verification",
  "contract_import",
  "identity_test",
  "resource_discovery",
  "run",
]);
assertType<Equal<z.output<typeof blockStageSchema>, Schemas["BlockStage"]>>();

export const blockReasonSchema = z.enum([
  "address_not_allowed",
  "host_mismatch",
  "unresolved",
  "invalid_url",
  "scheme_not_allowed",
  "too_many_redirects",
]);
assertType<Equal<z.output<typeof blockReasonSchema>, Schemas["BlockReason"]>>();

/** Datos propios de cada acción: los que no aplican no aparecen. Se ignora lo que no se conoce. */
export const auditDetailsSchema = z.object({
  run_id: z.string().optional(),
  source_run_id: z.string().optional(),
  modules: z.array(moduleSchema).optional(),
  limits: runLimitsSchema.optional(),
  verification_method: verificationMethodSchema.optional(),
  identity_id: z.string().optional(),
  finding_id: z.string().optional(),
  dismissal_reason: dismissalReasonSchema.optional(),
  stage: blockStageSchema.optional(),
  block_reason: blockReasonSchema.optional(),
});
assertType<Equal<z.output<typeof auditDetailsSchema>, Schemas["AuditDetails"]>>();
export type AuditDetails = z.output<typeof auditDetailsSchema>;

export const auditLogEntrySchema = z.object({
  id: z.number().int().min(1),
  occurred_at: z.string(),
  action: auditActionSchema,
  user_id: z.string().nullable(),
  project_id: z.string().nullable(),
  source_ip: z.string().nullable(),
  details: auditDetailsSchema,
});
assertType<Equal<z.output<typeof auditLogEntrySchema>, Schemas["AuditLogEntry"]>>();
export type AuditLogEntry = z.output<typeof auditLogEntrySchema>;

export const auditLogPageSchema = pageSchema(auditLogEntrySchema);
assertType<Equal<z.output<typeof auditLogPageSchema>, Schemas["AuditLogPage"]>>();
export type AuditLogPage = z.output<typeof auditLogPageSchema>;

/** RFC 3339 con hora y zona (`2026-11-20T00:00:00-06:00` o `…Z`); una fecha sola es 422. */
const dateTime = z.iso.datetime({ offset: true, message: FIELD_CODES.format });

export const listAuditLogQuerySchema = z
  .strictObject({
    page: queryInt(1, 10000).optional(),
    page_size: queryInt(1, 100).optional(),
    occurred_from: dateTime.optional(),
    occurred_to: dateTime.optional(),
    action: queryList(auditActionSchema, AUDIT_ACTIONS.length).optional(),
    user_id: z.uuid({ message: FIELD_CODES.format }).optional(),
    host: zText({ min: 1, max: 2048 }).optional(),
  })
  .refine(
    (query) =>
      !query.occurred_from ||
      !query.occurred_to ||
      new Date(query.occurred_from) <= new Date(query.occurred_to),
    { path: ["occurred_to"], message: FIELD_CODES.format },
  );

/* ---------- Estadísticas (V-33, F-13) ---------- */

/**
 * `getAdminStats`: cifras anónimas de la plataforma, solo para el administrador. Salen de métricas
 * que se escriben al ocurrir cada hecho (RF-89): no traen URLs, contratos, credenciales ni
 * identificadores de analistas, proyectos o hallazgos.
 */
export const statsGroupSchema = z.enum(["day", "week"]);

export const adminStatsActivitySchema = z.object({
  /** El día, o el lunes de la semana. */
  start: z.string(),
  new_users: z.number().int().min(0),
  deleted_accounts: z.number().int().min(0),
  projects_created: z.number().int().min(0),
  runs_started: z.number().int().min(0),
  runs_cancelled: z.number().int().min(0),
  runs_failed: z.number().int().min(0),
});

export const adminStatsFindingsSchema = z.object({
  detected: z.number().int().min(0),
  resolved: z.number().int().min(0),
  regressions: z.number().int().min(0),
  /** Días promedio entre la detección y la corrección confirmada; `null` si no hay ninguna. */
  average_days_to_resolve: z.number().min(0).nullable(),
  by_severity: severityCountSchema,
  by_module: z.array(z.object({ module: moduleSchema, detected: z.number().int().min(1) })),
  by_owasp_category: z.array(
    z.object({ owasp_category: z.string(), detected: z.number().int().min(1) }),
  ),
  /** Detectados por semana (lunes), del lunes de `date_from` al de `date_to`, sin huecos. */
  weekly: z.array(z.object({ week: z.string(), detected: z.number().int().min(0) })),
});

export const adminStatsSchema = z.object({
  period: z.object({ date_from: z.string(), date_to: z.string(), group: statsGroupSchema }),
  users: z.object({
    total: z.number().int().min(0),
    new: z.number().int().min(0),
    deleted: z.number().int().min(0),
  }),
  projects: z.object({ created: z.number().int().min(0) }),
  runs: z.object({
    started: z.number().int().min(0),
    cancelled: z.number().int().min(0),
    failed: z.number().int().min(0),
  }),
  activity: z.array(adminStatsActivitySchema),
  findings: adminStatsFindingsSchema,
});
assertType<Equal<z.output<typeof adminStatsSchema>, Schemas["AdminStats"]>>();
export type AdminStats = z.output<typeof adminStatsSchema>;

/** Más de 366 días es 422 en la API (`validation.format`). */
export const MAX_STATS_DAYS = 366;
const DAY_MS = 86_400_000;
const statsDate = z.iso.date({ message: FIELD_CODES.format });

export const getAdminStatsQuerySchema = z
  .strictObject({
    date_from: statsDate.optional(),
    date_to: statsDate.optional(),
    group: statsGroupSchema.optional(),
  })
  .superRefine((query, ctx) => {
    if (!query.date_from || !query.date_to) return;
    const days = (Date.parse(query.date_to) - Date.parse(query.date_from)) / DAY_MS + 1;
    if (days < 1) ctx.addIssue({ code: "custom", path: ["date_to"], message: FIELD_CODES.format });
    else if (days > MAX_STATS_DAYS)
      ctx.addIssue({ code: "custom", path: ["date_from"], message: FIELD_CODES.format });
  });
