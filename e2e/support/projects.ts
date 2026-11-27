/**
 * Proyectos con la forma del contrato (`Project`, `ProjectPage`), copiados de sus ejemplos
 * (`components.examples.Project`, `NewHttpProject` y `ProjectPage`). Prism responde con el
 * primer ejemplo; estas variantes sirven para los estados que el simulador no produce.
 */
export const PROJECT_ID = "0192e3a0-2222-7000-8000-000000000001";
export const NEW_PROJECT_ID = "0192e3a0-2222-7000-8000-000000000002";

const ZERO = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };

export function project(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    name: "API de pedidos",
    description: "API pública de la tienda, entorno de staging.",
    base_url: "https://api.tienda-ejemplo.com/v1",
    host: "api.tienda-ejemplo.com",
    verification_status: "verified",
    verified_at: "2026-11-02T15:20:00Z",
    concluded: false,
    current_contract: {
      id: "0192e3a0-3333-7000-8000-000000000002",
      number: 2,
      source: "url",
      openapi_version: "3.0.3",
      operation_count: 18,
      imported_at: "2026-11-03T10:05:00Z",
    },
    last_run: {
      id: "0192e3a0-4444-7000-8000-000000000001",
      number: 1,
      status: "completed",
      end_reason: "normal",
      modules: ["authentication", "configuration", "object_access", "function_access"],
      requests_sent: 312,
      findings_by_severity: { critical: 1, high: 2, medium: 3, low: 1, info: 0, total: 7 },
      created_at: "2026-11-03T17:30:00Z",
      started_at: "2026-11-03T17:30:02Z",
      finished_at: "2026-11-03T17:42:10Z",
    },
    open_findings_by_severity: { critical: 1, high: 2, medium: 1, low: 1, info: 0, total: 5 },
    modules: [
      { module: "authentication", risk: "low", available: true, missing: [] },
      { module: "configuration", risk: "low", available: true, missing: [] },
      {
        module: "object_access",
        risk: "low",
        available: false,
        missing: ["insufficient_identities", "no_resources"],
      },
      {
        module: "function_access",
        risk: "low",
        available: false,
        missing: ["no_admin_identity", "policy_unconfirmed"],
      },
      { module: "property_access", risk: "medium", available: true, missing: [] },
      { module: "resource_consumption", risk: "high", available: true, missing: [] },
      { module: "sql_injection", risk: "high", available: true, missing: [] },
    ],
    warnings: [],
    created_at: "2026-11-02T15:00:00Z",
    updated_at: "2026-11-03T10:05:00Z",
    ...overrides,
  };
}

/** Ejemplo `NewHttpProject`: recién creado, pendiente y con URL HTTP. */
export function newHttpProject(overrides: Record<string, unknown> = {}) {
  const unverified = (missing: string[]) => ["project_not_verified", ...missing];
  return project({
    id: NEW_PROJECT_ID,
    name: "API interna de inventario",
    description: null,
    base_url: "http://inventario.ejemplo.mx",
    host: "inventario.ejemplo.mx",
    verification_status: "pending",
    verified_at: null,
    current_contract: null,
    last_run: null,
    open_findings_by_severity: ZERO,
    modules: [
      {
        module: "authentication",
        risk: "low",
        available: false,
        missing: unverified(["no_contract"]),
      },
      { module: "configuration", risk: "low", available: false, missing: unverified([]) },
      {
        module: "object_access",
        risk: "low",
        available: false,
        missing: unverified(["no_contract", "insufficient_identities", "no_resources"]),
      },
      {
        module: "function_access",
        risk: "low",
        available: false,
        missing: unverified(["no_contract", "no_admin_identity", "policy_unconfirmed"]),
      },
      {
        module: "property_access",
        risk: "medium",
        available: false,
        missing: unverified(["no_contract", "insufficient_identities"]),
      },
      {
        module: "resource_consumption",
        risk: "high",
        available: false,
        missing: unverified(["no_contract"]),
      },
      {
        module: "sql_injection",
        risk: "high",
        available: false,
        missing: unverified(["no_contract"]),
      },
    ],
    warnings: [
      {
        code: "url.no_tls",
        message: "La URL usa HTTP; el tráfico y las credenciales de prueba viajarán sin cifrar.",
        location: null,
      },
    ],
    created_at: "2026-11-04T09:30:00Z",
    updated_at: "2026-11-04T09:30:00Z",
    ...overrides,
  });
}

export function summary(p: ReturnType<typeof project>, openFindings: number) {
  return {
    id: p.id,
    name: p.name,
    base_url: p.base_url,
    verification_status: p.verification_status,
    concluded: p.concluded,
    last_run_at: (p.last_run as { finished_at: string } | null)?.finished_at ?? null,
    open_findings: openFindings,
    created_at: p.created_at,
  };
}

export function page(items: unknown[], total = items.length, pageNumber = 1, pageSize = 20) {
  return { items, total, page: pageNumber, page_size: pageSize };
}
