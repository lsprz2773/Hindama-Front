import { createEnumAdapter } from "./adapter";

/** Clave de un módulo en los textos de la interfaz (`Dashboard.modules.names`). */
export type ModuleKey =
  | "auth"
  | "config"
  | "objects"
  | "functions"
  | "properties"
  | "resources"
  | "sql";

/** `Module` del contrato 0.6.0 (glosario de identificadores, «Módulo»). */
export type ApiModule =
  | "authentication"
  | "configuration"
  | "object_access"
  | "function_access"
  | "property_access"
  | "resource_consumption"
  | "sql_injection";

/** `ModuleAvailability.risk` del contrato. */
export type ApiModuleRisk = "low" | "medium" | "high";

const MODULES: Record<ModuleKey, ApiModule> = {
  auth: "authentication",
  config: "configuration",
  objects: "object_access",
  functions: "function_access",
  properties: "property_access",
  resources: "resource_consumption",
  sql: "sql_injection",
};

export const moduleAdapter = createEnumAdapter("module", MODULES, "config");

/**
 * Riesgo por módulo según los ejemplos del dashboard del contrato (`ModuleAvailability`) y
 * RN-05. Sirve solo para pintar la interfaz antes de cargar el dashboard: el valor que manda
 * es `modules[].risk` de `GET /projects/{project_id}`.
 */
export const MODULE_RISK: Record<ApiModule, ApiModuleRisk> = {
  authentication: "low",
  configuration: "low",
  object_access: "low",
  function_access: "low",
  property_access: "medium",
  resource_consumption: "high",
  sql_injection: "high",
};

/** RN-05 y RF-46: los de riesgo medio y alto exigen `confirm_risk: true` en cada ejecución. */
export function requiresRiskConfirmation(risk: ApiModuleRisk): boolean {
  return risk !== "low";
}
