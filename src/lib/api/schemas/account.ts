import { z } from "zod";
import type { Schemas } from "../types";
import { assertType, zText, type Equal } from "../zod";
import { roleSchema } from "./common";

/** `getMe` y `acceptTerms` (contrato: `Me`, `TermsStatus`, `TermsAcceptance`). */

export const termsStatusSchema = z.object({
  current_version: z.string(),
  accepted_version: z.string().nullable(),
  accepted_at: z.string().nullable(),
  acceptance_required: z.boolean(),
});
assertType<Equal<z.output<typeof termsStatusSchema>, Schemas["TermsStatus"]>>();

export const meSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: roleSchema,
  terms: termsStatusSchema,
});
assertType<Equal<z.output<typeof meSchema>, Schemas["Me"]>>();

/** Cuerpo de `POST /me/terms`: cerrado y con la longitud del contrato. */
export const termsAcceptanceSchema = z.strictObject({
  version: zText({ min: 1, max: 50 }),
});
assertType<Equal<z.output<typeof termsAcceptanceSchema>, Schemas["TermsAcceptance"]>>();

export type Me = z.output<typeof meSchema>;
