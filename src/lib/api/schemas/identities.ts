import { z } from "zod";
import type { Schemas } from "../types";
import { assertType, FIELD_CODES, hasControlChars, zText, type Equal } from "../zod";
import { pageSchema, warningSchema } from "./common";
import { operationRefSchema } from "./contracts";
import { queryInt } from "./projects";

/**
 * Identidades de prueba: `listIdentities`, `createIdentity`, `updateIdentity`,
 * `deleteIdentity` y `testIdentity` (V-21 y V-22). La credencial solo viaja de ida, una vez,
 * y nunca vuelve en una respuesta (RN-11): solo `credential_suffix`.
 */

export const identityRoleSchema = z.enum(["admin", "user", "other"]);
assertType<Equal<z.output<typeof identityRoleSchema>, Schemas["IdentityRole"]>>();
export type IdentityRole = z.output<typeof identityRoleSchema>;

export const authTypeSchema = z.enum(["none", "login", "bearer", "cookie", "header"]);
assertType<Equal<z.output<typeof authTypeSchema>, Schemas["AuthType"]>>();
export type AuthType = z.output<typeof authTypeSchema>;

export const identitySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: identityRoleSchema,
  role_label: z.string().nullable(),
  auth_type: authTypeSchema,
  credential_suffix: z.string().max(4).nullable(),
  field_name: z.string().nullable(),
  login_operation: operationRefSchema.nullable(),
  status: z.enum(["active", "expired_credential"]),
  last_tested_at: z.string().nullable(),
  last_test_status_code: z.number().int().nullable(),
  resource_count: z.number().int().min(0),
  warnings: z.array(warningSchema),
  created_at: z.string(),
});
assertType<Equal<z.output<typeof identitySchema>, Schemas["Identity"]>>();
export type Identity = z.output<typeof identitySchema>;

export const identityPageSchema = pageSchema(identitySchema);
assertType<Equal<z.output<typeof identityPageSchema>, Schemas["IdentityPage"]>>();

export const listIdentitiesQuerySchema = z.strictObject({
  page: queryInt(1, 10000).optional(),
  page_size: queryInt(1, 100).optional(),
});

/**
 * Secreto de una credencial: se envía tal cual (sin recortar ni normalizar, los espacios
 * cuentan), de 1 a 4096 caracteres y sin caracteres de control.
 */
const zSecret = z
  .string({ error: FIELD_CODES.required })
  .min(1, { message: FIELD_CODES.required })
  .max(4096, { message: FIELD_CODES.length })
  .refine((value) => !hasControlChars(value), { message: FIELD_CODES.format });

export const loginCredentialSchema = z.strictObject({ username: zSecret, password: zSecret });
export const tokenCredentialSchema = z.strictObject({ token: zSecret });
export const valueCredentialSchema = z.strictObject({ value: zSecret });
export const credentialSchema = z.union([
  loginCredentialSchema,
  tokenCredentialSchema,
  valueCredentialSchema,
]);
assertType<Equal<z.output<typeof credentialSchema>, Schemas["Credential"]>>();
export type Credential = z.output<typeof credentialSchema>;

/** Nombre de cookie o cabecera: un `token` de HTTP (RFC 9110). */
const zFieldName = z
  .string()
  .min(1, { message: FIELD_CODES.required })
  .max(100, { message: FIELD_CODES.length })
  .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, { message: FIELD_CODES.format });

const identityName = zText({ min: 1, max: 100 });
const roleLabel = zText({ max: 100 })
  .transform((value) => (value === "" ? null : value))
  .nullable();
const creatableAuth = z.enum(["login", "bearer", "cookie", "header"]);
export type CreatableAuthType = z.output<typeof creatableAuth>;

/** Forma de la credencial que corresponde a cada tipo (`identity.credential_mismatch`). */
const CREDENTIAL_FOR: Record<CreatableAuthType, z.ZodType> = {
  login: loginCredentialSchema,
  bearer: tokenCredentialSchema,
  cookie: valueCredentialSchema,
  header: valueCredentialSchema,
};

function checkShape(
  value: {
    auth_type?: CreatableAuthType;
    credential?: Credential;
    field_name?: string | null;
    login_operation_id?: string | null;
  },
  ctx: z.RefinementCtx,
  creating: boolean,
) {
  const auth = value.auth_type;
  if (!auth) return;
  if (value.credential && !CREDENTIAL_FOR[auth].safeParse(value.credential).success) {
    ctx.addIssue({ code: "custom", path: ["credential"], message: "identity.credential_mismatch" });
  }
  if (!creating) return;
  if ((auth === "cookie" || auth === "header") && !value.field_name) {
    ctx.addIssue({ code: "custom", path: ["field_name"], message: "identity.field_name_required" });
  }
  if (auth === "login" && !value.login_operation_id) {
    ctx.addIssue({
      code: "custom",
      path: ["login_operation_id"],
      message: "identity.login_operation_required",
    });
  }
}

export const identityCreateSchema = z
  .strictObject({
    name: identityName,
    role: identityRoleSchema,
    role_label: roleLabel.optional(),
    auth_type: creatableAuth,
    credential: credentialSchema,
    field_name: zFieldName.nullable().optional(),
    login_operation_id: z.uuid({ message: FIELD_CODES.format }).nullable().optional(),
  })
  .superRefine((value, ctx) => checkShape(value, ctx, true));
export type IdentityCreate = z.output<typeof identityCreateSchema>;
assertType<Equal<IdentityCreate, Schemas["IdentityCreate"]>>();

export const identityUpdateSchema = z
  .strictObject({
    name: identityName.optional(),
    role: identityRoleSchema.optional(),
    role_label: roleLabel.optional(),
    auth_type: creatableAuth.optional(),
    credential: credentialSchema.optional(),
    field_name: zFieldName.nullable().optional(),
    login_operation_id: z.uuid({ message: FIELD_CODES.format }).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: "custom", message: FIELD_CODES.required });
    }
    if (value.auth_type && !value.credential) {
      ctx.addIssue({
        code: "custom",
        path: ["credential"],
        message: "identity.credential_required",
      });
    }
    checkShape(value, ctx, false);
  });
export type IdentityUpdate = z.output<typeof identityUpdateSchema>;
assertType<Equal<IdentityUpdate, Schemas["IdentityUpdate"]>>();

export const identityTestRequestSchema = z.strictObject({
  operation_id: z.uuid({ message: FIELD_CODES.format }).nullable().optional(),
});
assertType<Equal<z.output<typeof identityTestRequestSchema>, Schemas["IdentityTestRequest"]>>();

export const identityTestSchema = z.object({
  succeeded: z.boolean(),
  status_code: z.number().int().nullable(),
  failure: z
    .enum(["rejected", "login_failed", "connection_error", "destination_not_allowed"])
    .nullable(),
  operation: operationRefSchema,
  tested_at: z.string(),
});
assertType<Equal<z.output<typeof identityTestSchema>, Schemas["IdentityTest"]>>();
export type IdentityTest = z.output<typeof identityTestSchema>;
