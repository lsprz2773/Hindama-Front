import { z } from "zod";
import type { Schemas } from "../types";
import { assertType, FIELD_CODES, zText, type Equal } from "../zod";
import { pageSchema } from "./common";
import { queryInt } from "./projects";

/**
 * Recursos por identidad: `listResources`, `createResource`, `updateResource` y
 * `deleteResource` (V-23). `discoverResources` no se conecta (pendiente de contrato del flujo).
 */

export const resourceSchema = z.object({
  id: z.string(),
  identity_id: z.string(),
  resource_type: z.string(),
  value: z.string(),
  source: z.enum(["discovered", "manual"]),
  confirmed: z.boolean(),
  created_at: z.string(),
});
assertType<Equal<z.output<typeof resourceSchema>, Schemas["Resource"]>>();
export type Resource = z.output<typeof resourceSchema>;

export const resourcePageSchema = pageSchema(resourceSchema);
assertType<Equal<z.output<typeof resourcePageSchema>, Schemas["ResourcePage"]>>();

const resourceType = zText({ min: 1, max: 100 });
const resourceValue = zText({ min: 1, max: 500 });
const identityId = z.uuid({ message: FIELD_CODES.format });

export const listResourcesQuerySchema = z.strictObject({
  page: queryInt(1, 10000).optional(),
  page_size: queryInt(1, 100).optional(),
  identity_id: identityId.optional(),
  resource_type: resourceType.optional(),
});

export const resourceCreateSchema = z.strictObject({
  identity_id: identityId,
  resource_type: resourceType,
  value: resourceValue,
});
export type ResourceCreate = z.output<typeof resourceCreateSchema>;
assertType<Equal<ResourceCreate, Schemas["ResourceCreate"]>>();

export const resourceUpdateSchema = z
  .strictObject({
    identity_id: identityId.optional(),
    resource_type: resourceType.optional(),
    value: resourceValue.optional(),
    confirmed: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: FIELD_CODES.required });
export type ResourceUpdate = z.output<typeof resourceUpdateSchema>;
assertType<Equal<ResourceUpdate, Schemas["ResourceUpdate"]>>();

/** `discoverResources`: sin `identity_ids` usa todas las identidades vigentes menos la anónima. */
export const resourceDiscoveryRequestSchema = z.strictObject({
  identity_ids: z
    .array(identityId)
    .min(1)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, { message: FIELD_CODES.format })
    .optional(),
});
export type ResourceDiscoveryRequest = z.output<typeof resourceDiscoveryRequestSchema>;
assertType<Equal<ResourceDiscoveryRequest, Schemas["ResourceDiscoveryRequest"]>>();

export const discoveryIdentityResultSchema = z.object({
  identity_id: z.string(),
  found: z.number().int().min(0),
  created: z.number().int().min(0),
  owned_by_other: z.number().int().min(0),
  failure: z
    .enum([
      "rejected",
      "login_failed",
      "connection_error",
      "destination_not_allowed",
      "not_attempted",
    ])
    .nullable(),
});
assertType<
  Equal<z.output<typeof discoveryIdentityResultSchema>, Schemas["DiscoveryIdentityResult"]>
>();
export type DiscoveryIdentityResult = z.output<typeof discoveryIdentityResultSchema>;

export const resourceDiscoverySchema = z.object({
  created: z.array(resourceSchema),
  identities: z.array(discoveryIdentityResultSchema),
  requests_sent: z.number().int().min(0),
  truncated: z.boolean(),
});
assertType<Equal<z.output<typeof resourceDiscoverySchema>, Schemas["ResourceDiscovery"]>>();
export type ResourceDiscovery = z.output<typeof resourceDiscoverySchema>;
