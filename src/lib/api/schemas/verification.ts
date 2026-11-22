import { z } from "zod";
import type { Schemas } from "../types";
import { assertType, type Equal } from "../zod";
import { verificationMethodSchema, verificationStatusSchema } from "./common";

/** Verificación de propiedad del host: `getVerification` y `verifyOwnership` (V-18). */

export const verificationSchema = z.object({
  status: verificationStatusSchema,
  host: z.string(),
  code: z.string(),
  method: verificationMethodSchema.nullable(),
  verified_at: z.string().nullable(),
  file: z.object({ url: z.string(), content: z.string() }),
  dns: z.object({ name: z.string(), type: z.literal("TXT"), value: z.string() }),
});
assertType<Equal<z.output<typeof verificationSchema>, Schemas["Verification"]>>();
export type Verification = z.output<typeof verificationSchema>;

export const verificationRequestSchema = z.object({ method: verificationMethodSchema }).strict();
assertType<Equal<z.output<typeof verificationRequestSchema>, Schemas["VerificationRequest"]>>();
export type VerificationRequest = z.output<typeof verificationRequestSchema>;
