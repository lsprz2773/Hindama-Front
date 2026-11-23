import type { Page } from "@playwright/test";

/**
 * Ejecuciones con la forma del contrato (`Run`, `RunSummary`), copiadas de sus ejemplos
 * (`components.examples.RunningRun` y `QueuedRun`). El simulador no produce un stream válido
 * (`streamRunEvents` trae JSON de ejemplo inválido), así que el progreso en vivo se simula aquí.
 */
export const RUN_ID = "0192e3a0-7777-7000-8000-000000000003";

const SEVERITY = { critical: 0, high: 2, medium: 0, low: 0, info: 0, total: 2 };

export function runningRun(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    number: 3,
    status: "running",
    end_reason: null,
    modules: ["object_access", "function_access", "sql_injection"],
    limits: {
      requests_per_second: 5,
      concurrency: 2,
      max_requests: 5000,
      max_duration_minutes: 30,
    },
    risk_confirmed: true,
    contract_version: {
      id: "0192e3a0-3333-7000-8000-000000000002",
      number: 2,
      source: "url",
      openapi_version: "3.0.3",
      operation_count: 18,
      imported_at: "2026-11-03T10:05:00Z",
    },
    source_run_id: null,
    progress: {
      status: "running",
      current_module: "object_access",
      requests_sent: 42,
      cells_planned: 120,
      cells_evaluated: 38,
      percent: 31,
      findings_by_severity: SEVERITY,
      updated_at: "2026-11-17T09:10:41Z",
    },
    created_resources: { pending: 0, deleted: 0, failed: 0, failed_items: [] },
    cancel_requested_at: null,
    created_at: "2026-11-17T09:10:00Z",
    started_at: "2026-11-17T09:10:02Z",
    finished_at: null,
    ...overrides,
  };
}

/** `RunSummary` de la ejecución en curso, para el `last_run` del proyecto. */
export function runningSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    number: 3,
    status: "running",
    end_reason: null,
    modules: ["object_access", "function_access", "sql_injection"],
    requests_sent: 42,
    findings_by_severity: SEVERITY,
    created_at: "2026-11-17T09:10:00Z",
    started_at: "2026-11-17T09:10:02Z",
    finished_at: null,
    ...overrides,
  };
}

/** La ejecución en curso ya terminada (`end`). */
export function completedRun() {
  const run = runningRun();
  return runningRun({
    status: "completed",
    end_reason: "normal",
    progress: { ...run.progress, status: "completed", current_module: null, percent: 100 },
    created_resources: { pending: 0, deleted: 4, failed: 0, failed_items: [] },
    finished_at: "2026-11-17T09:14:37Z",
  });
}

type RunEvent = { event: "snapshot" | "progress" | "end"; data: unknown };

/**
 * Atiende el stream de progreso (`text/event-stream`) con `events`. `retry` largo para que
 * `EventSource` no reconecte durante la prueba y repita los eventos. `status` distinto de 200
 * cierra el stream del todo.
 */
export async function mockProgress(page: Page, events: RunEvent[], status = 200) {
  const urls: string[] = [];
  await page.route("**/api/projects/*/runs/*/progress", async (route) => {
    urls.push(route.request().url());
    const body =
      "retry: 600000\n\n" +
      events
        .map((e, i) => `id: ${i + 1}\nevent: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
        .join("");
    await route.fulfill({
      status,
      headers: {
        "content-type": status === 200 ? "text/event-stream" : "application/problem+json",
      },
      body: status === 200 ? body : "{}",
    });
  });
  return urls;
}
