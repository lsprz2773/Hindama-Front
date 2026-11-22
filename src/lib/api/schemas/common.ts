import { z } from "zod";
import type { Schemas } from "../types";
import { assertType, type Equal } from "../zod";

/**
 * Esquemas de respuesta compartidos. Las respuestas no usan `.strict()`: la guía del frontend
 * (§4.3) y las convenciones (§2) piden ignorar los campos que el cliente no conoce, porque
 * agregarlos es un cambio compatible. Los campos desconocidos se descartan al validar, así que
 * nunca llegan a la vista.
 */

export const warningSchema = z.object({
  code: z.string(),
  message: z.string(),
  location: z.string().nullable(),
});
assertType<Equal<z.output<typeof warningSchema>, Schemas["Warning"]>>();

/** Sobre de una lista paginada (convenciones §6). */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
  });
}

export const roleSchema = z.enum(["analyst", "admin"]);
assertType<Equal<z.output<typeof roleSchema>, Schemas["Role"]>>();

export const verificationStatusSchema = z.enum(["pending", "verified"]);
assertType<Equal<z.output<typeof verificationStatusSchema>, Schemas["VerificationStatus"]>>();

export const verificationMethodSchema = z.enum(["file", "dns"]);
assertType<Equal<z.output<typeof verificationMethodSchema>, Schemas["VerificationMethod"]>>();

export const httpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "TRACE",
]);
assertType<Equal<z.output<typeof httpMethodSchema>, Schemas["HttpMethod"]>>();

export const moduleSchema = z.enum([
  "authentication",
  "configuration",
  "object_access",
  "function_access",
  "property_access",
  "resource_consumption",
  "sql_injection",
]);
assertType<Equal<z.output<typeof moduleSchema>, Schemas["Module"]>>();

export const runStatusSchema = z.enum(["queued", "running", "completed", "cancelled", "failed"]);
assertType<Equal<z.output<typeof runStatusSchema>, Schemas["RunStatus"]>>();

export const endReasonSchema = z.enum([
  "normal",
  "limit_reached",
  "cancelled_by_user",
  "verification_invalid",
  "heartbeat_expired",
  "lost_in_queue",
  "error",
]);
assertType<Equal<z.output<typeof endReasonSchema>, Schemas["EndReason"]>>();

export const verdictSchema = z.enum(["pass", "fail", "skipped", "error"]);
assertType<Equal<z.output<typeof verdictSchema>, Schemas["Verdict"]>>();
