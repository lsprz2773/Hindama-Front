/**
 * Hallazgos con la forma del contrato (`FindingSummary`, `Finding`), copiados de sus ejemplos
 * (`components.examples.FindingPage` y `Finding`). Prism responde siempre el primero; estas
 * variantes sirven para los estados que el simulador no produce.
 */
export const FINDING_ID = "0192e3a0-8888-7000-8000-000000000001";

const RUN_2 = { id: "0192e3a0-7777-7000-8000-000000000002", number: 2 };
const RUN_3 = { id: "0192e3a0-7777-7000-8000-000000000003", number: 3 };

export function finding(overrides: Record<string, unknown> = {}) {
  return {
    id: FINDING_ID,
    module: "object_access",
    finding_type: "object_access.unauthorized_read",
    title: "Acceso a un objeto de otra identidad",
    severity: "high",
    owasp_category: "API1:2023",
    cwe: "CWE-639",
    status: "persistent",
    operation: {
      id: "0192e3a0-5555-7000-8000-000000000003",
      method: "GET",
      path: "/orders/{orderId}",
    },
    identity: { id: "0192e3a0-6666-7000-8000-000000000004", name: "Cliente B", deleted: false },
    detected_at: "2026-11-16T18:02:11Z",
    last_detected_at: "2026-11-17T09:10:21Z",
    resolved_at: null,
    first_run: RUN_2,
    last_run: RUN_3,
    ...overrides,
  };
}

export const OCCURRENCE = {
  run: RUN_3,
  severity: "high",
  explanation:
    "La identidad «Cliente B» obtuvo el recurso «1001» (order) de «Cliente A» con un 200, aunque la política confirmada de la operación permite el acceso solo al propietario.",
  evidence: {
    request: {
      method: "GET",
      url: "https://api.ejemplo.com/v1/orders/1001",
      headers: { accept: "application/json", authorization: "****x9Qz" },
      body: null,
    },
    response: {
      status_code: 200,
      headers: { "content-type": "application/json" },
      body: '{"id": 1001, "owner": "cliente-a", "total": 349.90}',
      body_truncated: false,
    },
    context: { resource: { type: "order", value: "1001", owner: "Cliente A" } },
  },
  detected_at: "2026-11-17T09:10:21Z",
};

export function findingDetail(overrides: Record<string, unknown> = {}) {
  return {
    ...finding(),
    recommendation:
      "Comprueba en el servidor, en cada petición, que el objeto solicitado pertenece al usuario autenticado antes de devolverlo, y responde 404 si no es suyo. No confíes en que el identificador sea difícil de adivinar.",
    dismissal: null,
    resolution_reason: null,
    last_occurrence: OCCURRENCE,
    history: [
      {
        from_status: null,
        to_status: "new",
        reason: "detected",
        run: RUN_2,
        justification: null,
        occurred_at: "2026-11-16T18:02:11Z",
      },
      {
        from_status: "new",
        to_status: "persistent",
        reason: "detected",
        run: RUN_3,
        justification: null,
        occurred_at: "2026-11-17T09:10:21Z",
      },
    ],
    ...overrides,
  };
}
