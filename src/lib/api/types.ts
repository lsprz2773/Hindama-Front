/**
 * Tipos de la API generados desde el contrato 0.6.0 (`contract/openapi.yaml`). No se
 * escriben a mano: `npm run contract:types` los regenera y `npm run contract:check` falla
 * si dejan de coincidir con el contrato.
 */
import type { components, operations } from "./schema";

export type Schemas = components["schemas"];
export type Operations = operations;
