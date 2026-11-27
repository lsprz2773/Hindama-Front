import type { Schemas } from "@/lib/api/types";

type Module = Schemas["Module"];

/**
 * Módulo del contrato → clave de textos de la interfaz y su categoría de OWASP API Top 10 2023
 * (F-09). El orden es el del catálogo, el mismo en que la API devuelve `modules`.
 */
export const MODULE_VIEW = {
  authentication: { key: "auth", code: "API2" },
  configuration: { key: "config", code: "API8" },
  object_access: { key: "objects", code: "API1" },
  function_access: { key: "functions", code: "API5" },
  property_access: { key: "properties", code: "API3" },
  resource_consumption: { key: "resources", code: "API4" },
  sql_injection: { key: "sql", code: "SQL" },
} as const satisfies Record<Module, { key: string; code: string }>;

export const MODULE_ORDER = Object.keys(MODULE_VIEW) as Module[];

export type ModuleTextKey = (typeof MODULE_VIEW)[Module]["key"];

/** Clave de la interfaz (`?module=auth` del dashboard) → módulo del contrato. */
export function moduleFromKey(key: string | null): Module | null {
  return MODULE_ORDER.find((m) => MODULE_VIEW[m].key === key) ?? null;
}
