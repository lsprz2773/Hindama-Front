// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "./cognito";
import { handleApiRoute, handleRunEvents } from "./route";
import { SPECS } from "./specs";
import { deps, ORIGIN, session, sessionCookie } from "./test-utils";

/** Rutas del BFF de ejecuciones y hallazgos (fase 5). */
const PID = "0192e3a0-2222-7000-8000-000000000001";
const RID = "0192e3a0-7777-7000-8000-000000000003";
const FID = "0192e3a0-9999-7000-8000-000000000001";
const IID = "0192e3a0-6666-7000-8000-000000000002";
const params = { projectId: PID };
const runParams = { projectId: PID, runId: RID };
const findingParams = { projectId: PID, findingId: FID };
const API = "http://api.internal:8000";

function request(
  method: string,
  path: string,
  { body, headers = {} }: { body?: unknown; headers?: Record<string, string> } = {},
) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      cookie: sessionCookie(session()),
      origin: ORIGIN,
      "x-csrf-token": "csrf-token",
      "content-type": "application/json",
      ...headers,
    },
  });
}

const api = (response: Response) => vi.fn<FetchLike>(async () => response.clone());
const severity = { critical: 0, high: 1, medium: 0, low: 0, info: 0, total: 1 };
const RUN = {
  id: RID,
  number: 3,
  status: "queued",
  end_reason: null,
  modules: ["object_access"],
  limits: { requests_per_second: 5, concurrency: 2, max_requests: 5000, max_duration_minutes: 30 },
  risk_confirmed: false,
  contract_version: null,
  source_run_id: null,
  progress: {
    status: "queued",
    current_module: null,
    requests_sent: 0,
    cells_planned: 0,
    cells_evaluated: 0,
    percent: 0,
    findings_by_severity: severity,
    updated_at: "2026-11-16T10:00:00Z",
  },
  created_resources: { pending: 0, deleted: 0, failed: 0, failed_items: [] },
  cancel_requested_at: null,
  created_at: "2026-11-16T10:00:00Z",
  started_at: null,
  finished_at: null,
};

describe("ejecuciones (V-25 a V-28)", () => {
  it("createRun reenvía módulos, límites y la confirmación de riesgo", async () => {
    const apiFetch = api(Response.json(RUN, { status: 202 }));
    const body = {
      modules: ["object_access", "resource_consumption"],
      limits: { requests_per_second: 10 },
      confirm_risk: true,
    };
    const response = await handleApiRoute(
      SPECS.createRun,
      request("POST", `/api/projects/${PID}/runs`, { body }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(202);
    expect(String(apiFetch.mock.calls[0][0])).toBe(`${API}/projects/${PID}/runs`);
    expect(JSON.parse(String(apiFetch.mock.calls[0][1].body))).toEqual(body);
  });

  it.each([
    ["sin módulos", { modules: [] }],
    ["un módulo desconocido", { modules: ["admin_panel"] }],
    ["un módulo repetido", { modules: ["configuration", "configuration"] }],
    ["un límite fuera del tope", { modules: ["configuration"], limits: { concurrency: 6 } }],
    ["un límite decimal", { modules: ["configuration"], limits: { max_requests: 1.5 } }],
    ["un límite desconocido", { modules: ["configuration"], limits: { timeout: 1 } }],
    ["confirmar con texto", { modules: ["configuration"], confirm_risk: "true" }],
    ["campos extra", { modules: ["configuration"], identities: [IID] }],
  ])("createRun rechaza %s sin llamar a la API", async (_label, body) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.createRun,
      request("POST", `/api/projects/${PID}/runs`, { body }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("listRuns reenvía los estados repetidos", async () => {
    const apiFetch = api(Response.json({ items: [], total: 0, page: 1, page_size: 20 }));
    const response = await handleApiRoute(
      SPECS.listRuns,
      request("GET", `/api/projects/${PID}/runs?status=queued&status=running`),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(200);
    expect(String(apiFetch.mock.calls[0][0])).toBe(
      `${API}/projects/${PID}/runs?status=queued&status=running`,
    );
  });

  it.each([
    ["un estado desconocido", "status=paused"],
    ["un estado repetido", "status=queued&status=queued"],
    ["un page_size grande", "page_size=101"],
  ])("listRuns rechaza %s", async (_label, query) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.listRuns,
      request("GET", `/api/projects/${PID}/runs?${query}`),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("getRun trata una respuesta fuera del contrato como error", async () => {
    const apiFetch = api(Response.json({ ...RUN, status: "paused" }));
    const response = await handleApiRoute(
      SPECS.getRun,
      request("GET", `/api/projects/${PID}/runs/${RID}`),
      runParams,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(502);
  });

  it("cancelRun y rerunRun usan la ruta de la ejecución; cancelRun no reenvía cuerpo", async () => {
    const cancelFetch = api(Response.json(RUN, { status: 202 }));
    const cancelled = await handleApiRoute(
      SPECS.cancelRun,
      request("POST", `/api/projects/${PID}/runs/${RID}/cancel`, { body: { force: true } }),
      runParams,
      deps({ apiFetch: cancelFetch }),
    );
    expect(cancelled.status).toBe(202);
    expect(String(cancelFetch.mock.calls[0][0])).toBe(`${API}/projects/${PID}/runs/${RID}/cancel`);
    expect(cancelFetch.mock.calls[0][1].body).toBeUndefined();

    const rerunFetch = api(Response.json({ ...RUN, source_run_id: RID }, { status: 202 }));
    const rerun = await handleApiRoute(
      SPECS.rerunRun,
      request("POST", `/api/projects/${PID}/runs/${RID}/rerun`, { body: { confirm_risk: true } }),
      runParams,
      deps({ apiFetch: rerunFetch }),
    );
    expect(rerun.status).toBe(202);
    expect(JSON.parse(String(rerunFetch.mock.calls[0][1].body))).toEqual({ confirm_risk: true });
  });

  it("rerunRun no acepta cambiar los módulos", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.rerunRun,
      request("POST", `/api/projects/${PID}/runs/${RID}/rerun`, {
        body: { modules: ["sql_injection"] },
      }),
      runParams,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("listRunResults valida módulo, veredicto e ids", async () => {
    const apiFetch = api(Response.json({ items: [], total: 0, page: 1, page_size: 500 }));
    const ok = await handleApiRoute(
      SPECS.listRunResults,
      request("GET", `/api/projects/${PID}/runs/${RID}/results?verdict=fail&page_size=500`),
      runParams,
      deps({ apiFetch }),
    );
    expect(ok.status).toBe(200);

    const badFetch = vi.fn<FetchLike>();
    for (const query of ["verdict=maybe", "page_size=501", "identity_id=a"]) {
      const bad = await handleApiRoute(
        SPECS.listRunResults,
        request("GET", `/api/projects/${PID}/runs/${RID}/results?${query}`),
        runParams,
        deps({ apiFetch: badFetch }),
      );
      expect(bad.status).toBe(422);
    }
    expect(badFetch).not.toHaveBeenCalled();
  });

  it("un id de ejecución que no es UUID responde 404", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.getRun,
      request("GET", `/api/projects/${PID}/runs/3`),
      { projectId: PID, runId: "3" },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(404);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("progreso por SSE (V-26)", () => {
  function sse() {
    return vi.fn<FetchLike>(
      async () =>
        new Response("id: 1\nevent: snapshot\ndata: {}\n\n", {
          headers: { "content-type": "text/event-stream" },
        }),
    );
  }

  it("reenvía el stream y un Last-Event-ID válido", async () => {
    const apiFetch = sse();
    const response = await handleRunEvents(
      request("GET", `/api/projects/${PID}/runs/${RID}/progress`, {
        headers: { "last-event-id": "42" },
      }),
      runParams,
      deps({ apiFetch }),
    );
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(String(apiFetch.mock.calls[0][0])).toBe(`${API}/projects/${PID}/runs/${RID}/events`);
    expect(new Headers(apiFetch.mock.calls[0][1].headers).get("last-event-id")).toBe("42");
  });

  it.each([
    ["un id de ejecución que no es UUID", { projectId: PID, runId: "../../admin" }, {}, 404],
    ["un Last-Event-ID largo", runParams, { "last-event-id": "1".repeat(65) }, 422],
  ])("rechaza %s sin llamar a la API", async (_label, routeParams, headers, status) => {
    const apiFetch = sse();
    const response = await handleRunEvents(
      request("GET", `/api/projects/${PID}/runs/x/progress`, { headers }),
      routeParams,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(status);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("no admite parámetros de consulta", async () => {
    const apiFetch = sse();
    const response = await handleRunEvents(
      request("GET", `/api/projects/${PID}/runs/${RID}/progress?url=http://evil`),
      runParams,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("hallazgos (V-29 y V-30)", () => {
  it("listFindings reenvía filtros repetidos y rechaza los desconocidos", async () => {
    const apiFetch = api(Response.json({ items: [], total: 0, page: 1, page_size: 20 }));
    const ok = await handleApiRoute(
      SPECS.listFindings,
      request(
        "GET",
        `/api/projects/${PID}/findings?status=new&status=regression&severity=high&run_id=${RID}`,
      ),
      params,
      deps({ apiFetch }),
    );
    expect(ok.status).toBe(200);
    expect(String(apiFetch.mock.calls[0][0])).toContain("status=new&status=regression");

    const badFetch = vi.fn<FetchLike>();
    for (const query of ["severity=urgent", "run_id=3", "q=texto"]) {
      const bad = await handleApiRoute(
        SPECS.listFindings,
        request("GET", `/api/projects/${PID}/findings?${query}`),
        params,
        deps({ apiFetch: badFetch }),
      );
      expect(bad.status).toBe(422);
    }
    expect(badFetch).not.toHaveBeenCalled();
  });

  it("listFindingOccurrences admite hasta 20 por página", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.listFindingOccurrences,
      request("GET", `/api/projects/${PID}/findings/${FID}/occurrences?page_size=21`),
      findingParams,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("dismissFinding recorta la justificación y conserva los saltos de línea", async () => {
    const apiFetch = api(new Response(null, { status: 409 }));
    await handleApiRoute(
      SPECS.dismissFinding,
      request("POST", `/api/projects/${PID}/findings/${FID}/dismissal`, {
        body: { reason: "false_positive", justification: "  Es un endpoint público.\nVer ADR. " },
      }),
      findingParams,
      deps({ apiFetch }),
    );
    expect(JSON.parse(String(apiFetch.mock.calls[0][1].body))).toEqual({
      reason: "false_positive",
      justification: "Es un endpoint público.\nVer ADR.",
    });
  });

  it.each([
    ["sin justificación", { reason: "accepted_risk", justification: "   " }],
    ["una justificación larga", { reason: "accepted_risk", justification: "a".repeat(2001) }],
    ["caracteres de control", { reason: "accepted_risk", justification: "ok\u0007" }],
    ["un motivo desconocido", { reason: "wont_fix", justification: "ok" }],
  ])("dismissFinding rechaza %s", async (_label, body) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.dismissFinding,
      request("POST", `/api/projects/${PID}/findings/${FID}/dismissal`, { body }),
      findingParams,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("revertDismissal exige CSRF", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.revertDismissal,
      request("DELETE", `/api/projects/${PID}/findings/${FID}/dismissal`, {
        headers: { "x-csrf-token": "otro" },
      }),
      findingParams,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
