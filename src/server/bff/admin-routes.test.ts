// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "./cognito";
import { handleApiRoute } from "./route";
import { SPECS } from "./specs";
import { deps, ORIGIN, session, sessionCookie } from "./test-utils";

/** Rutas del BFF de administración (V-34): la bitácora, solo lectura. */
const USER = "0192e3a0-1111-7000-8000-000000000001";
const PROJECT = "0192e3a0-2222-7000-8000-000000000001";
const RUN = "0192e3a0-7777-7000-8000-000000000003";

const ENTRY = {
  id: 1041,
  occurred_at: "2026-11-17T09:10:00Z",
  action: "run_launched",
  user_id: USER,
  project_id: PROJECT,
  source_ip: "203.0.113.25",
  details: {
    run_id: RUN,
    modules: ["object_access", "configuration"],
    limits: {
      requests_per_second: 5,
      concurrency: 2,
      max_requests: 5000,
      max_duration_minutes: 30,
    },
  },
};
const PAGE = { items: [ENTRY], total: 1, page: 1, page_size: 20 };

function request(path: string) {
  return new Request(`${ORIGIN}${path}`, {
    method: "GET",
    headers: { cookie: sessionCookie(session()), origin: ORIGIN },
  });
}

function call(query: string, apiFetch: ReturnType<typeof vi.fn<FetchLike>>) {
  return handleApiRoute(
    SPECS.listAuditLog,
    request(`/api/admin/audit-log${query}`),
    {},
    deps({ apiFetch }),
  );
}

describe("listAuditLog (V-34)", () => {
  it("usa la ruta fija de la API, reenvía los filtros y valida la página", async () => {
    const apiFetch = vi.fn<FetchLike>(async () => Response.json(PAGE));
    const query =
      "?page=2&page_size=20&occurred_from=2026-11-17T06:00:00.000Z&occurred_to=2026-11-18T06:00:00.000Z" +
      `&action=run_launched&action=destination_blocked&user_id=${USER}&host=api.ejemplo.mx`;
    const response = await call(query, apiFetch);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PAGE);
    const url = new URL(String(apiFetch.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("http://api.internal:8000/admin/audit-log");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.getAll("action")).toEqual(["run_launched", "destination_blocked"]);
    expect(url.searchParams.get("user_id")).toBe(USER);
    expect(url.searchParams.get("host")).toBe("api.ejemplo.mx");
    expect(url.searchParams.get("occurred_from")).toBe("2026-11-17T06:00:00.000Z");
  });

  it("acepta una sola acción y una zona con desfase", async () => {
    const apiFetch = vi.fn<FetchLike>(async () => Response.json(PAGE));
    const response = await call(
      "?action=account_deleted&occurred_from=2026-11-20T00:00:00-06:00",
      apiFetch,
    );
    expect(response.status).toBe(200);
    expect(new URL(String(apiFetch.mock.calls[0][0])).searchParams.getAll("action")).toEqual([
      "account_deleted",
    ]);
  });

  it.each([
    ["una fecha sola, sin hora ni zona", "occurred_from=2026-11-20"],
    ["una fecha sin zona", "occurred_to=2026-11-20T00:00:00"],
    ["segundos Unix", "occurred_from=1763366400"],
    ["un rango invertido", "occurred_from=2026-11-20T00:00:00Z&occurred_to=2026-11-19T00:00:00Z"],
    ["una acción desconocida", "action=riskAccepted"],
    ["acciones repetidas", "action=run_launched&action=run_launched"],
    ["un user_id que no es UUID", "user_id=luis@ejemplo.mx"],
    ["un host vacío", "host="],
    ["un host con caracteres de control", "host=api%0A.ejemplo.mx"],
    ["un host de más de 2048 caracteres", `host=${"a".repeat(2049)}`],
    ["un page_size mayor que 100", "page_size=101"],
    ["un parámetro desconocido", "email=luis@ejemplo.mx"],
  ])("rechaza %s sin llamar a la API", async (_label, query) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await call(`?${query}`, apiFetch);
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("trata una respuesta fuera del contrato como error", async () => {
    const apiFetch = vi.fn<FetchLike>(async () =>
      Response.json({ ...PAGE, items: [{ ...ENTRY, action: "magia" }] }),
    );
    const response = await call("", apiFetch);
    expect(response.status).toBe(502);
  });

  it("ignora los campos que no conoce de los detalles", async () => {
    const apiFetch = vi.fn<FetchLike>(async () =>
      Response.json({
        ...PAGE,
        items: [{ ...ENTRY, details: { ...ENTRY.details, nuevo: "campo futuro" } }],
      }),
    );
    const response = await call("", apiFetch);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].details).not.toHaveProperty("nuevo");
  });

  it("deja pasar el 403 del analista tal como lo responde la API", async () => {
    const apiFetch = vi.fn<FetchLike>(async () =>
      Response.json(
        {
          type: "about:blank",
          title: "Acción no permitida",
          status: 403,
          code: "role.forbidden",
          detail: "Tu rol no permite acceder a esta sección.",
          request_id: "req-1",
          errors: [],
        },
        { status: 403, headers: { "content-type": "application/problem+json" } },
      ),
    );
    const response = await call("", apiFetch);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("role.forbidden");
  });
});

const STATS = {
  period: { date_from: "2026-11-16", date_to: "2026-11-22", group: "day" },
  users: { total: 18, new: 3, deleted: 0 },
  projects: { created: 4 },
  runs: { started: 12, cancelled: 1, failed: 1 },
  activity: [
    {
      start: "2026-11-16",
      new_users: 1,
      deleted_accounts: 0,
      projects_created: 2,
      runs_started: 3,
      runs_cancelled: 0,
      runs_failed: 0,
    },
  ],
  findings: {
    detected: 9,
    resolved: 3,
    regressions: 1,
    average_days_to_resolve: 2.67,
    by_severity: { critical: 1, high: 3, medium: 2, low: 2, info: 1, total: 9 },
    by_module: [{ module: "object_access", detected: 4 }],
    by_owasp_category: [{ owasp_category: "API1:2023", detected: 4 }],
    weekly: [{ week: "2026-11-16", detected: 9 }],
  },
};

function callStats(query: string, apiFetch: ReturnType<typeof vi.fn<FetchLike>>) {
  return handleApiRoute(
    SPECS.getAdminStats,
    request(`/api/admin/stats${query}`),
    {},
    deps({ apiFetch }),
  );
}

describe("getAdminStats (V-33)", () => {
  it("usa la ruta fija de la API, reenvía el periodo y valida la respuesta", async () => {
    const apiFetch = vi.fn<FetchLike>(async () => Response.json(STATS));
    const response = await callStats(
      "?date_from=2026-11-16&date_to=2026-11-22&group=week",
      apiFetch,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(STATS);
    const url = new URL(String(apiFetch.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("http://api.internal:8000/admin/stats");
    expect(url.searchParams.get("date_from")).toBe("2026-11-16");
    expect(url.searchParams.get("date_to")).toBe("2026-11-22");
    expect(url.searchParams.get("group")).toBe("week");
  });

  it("acepta la consulta sin parámetros (los 30 días que terminan hoy)", async () => {
    const apiFetch = vi.fn<FetchLike>(async () => Response.json(STATS));
    expect((await callStats("", apiFetch)).status).toBe(200);
    expect(new URL(String(apiFetch.mock.calls[0][0])).search).toBe("");
  });

  it("deja pasar un promedio de resolución nulo", async () => {
    const apiFetch = vi.fn<FetchLike>(async () =>
      Response.json({ ...STATS, findings: { ...STATS.findings, average_days_to_resolve: null } }),
    );
    const response = await callStats("", apiFetch);
    expect((await response.json()).findings.average_days_to_resolve).toBeNull();
  });

  it.each([
    ["una fecha con hora", "date_from=2026-11-16T00:00:00Z"],
    ["segundos Unix", "date_from=1763251200"],
    ["una fecha que no existe", "date_to=2026-02-31"],
    ["un rango invertido", "date_from=2026-11-20&date_to=2026-11-19"],
    ["un periodo de más de 366 días", "date_from=2025-11-01&date_to=2026-11-22"],
    ["una agrupación desconocida", "group=month"],
    ["un parámetro desconocido", "email=luis@ejemplo.mx"],
  ])("rechaza %s sin llamar a la API", async (_label, query) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await callStats(`?${query}`, apiFetch);
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("acepta exactamente 366 días", async () => {
    const apiFetch = vi.fn<FetchLike>(async () => Response.json(STATS));
    const response = await callStats("?date_from=2025-11-22&date_to=2026-11-22", apiFetch);
    expect(response.status).toBe(200);
  });

  it("trata una respuesta fuera del contrato como error", async () => {
    const apiFetch = vi.fn<FetchLike>(async () =>
      Response.json({ ...STATS, users: { total: -1, new: 0, deleted: 0 } }),
    );
    expect((await callStats("", apiFetch)).status).toBe(502);
  });

  it("descarta los campos que no conoce", async () => {
    const apiFetch = vi.fn<FetchLike>(async () =>
      Response.json({ ...STATS, nuevo: "campo futuro", users: { ...STATS.users, email: "x@y.z" } }),
    );
    const body = await (await callStats("", apiFetch)).json();
    expect(body).not.toHaveProperty("nuevo");
    expect(body.users).not.toHaveProperty("email");
  });

  it("deja pasar el 403 del analista tal como lo responde la API", async () => {
    const apiFetch = vi.fn<FetchLike>(async () =>
      Response.json(
        {
          type: "about:blank",
          title: "Acción no permitida",
          status: 403,
          code: "role.forbidden",
          detail: "Tu rol no permite acceder a esta sección.",
          request_id: "req-1",
          errors: [],
        },
        { status: 403, headers: { "content-type": "application/problem+json" } },
      ),
    );
    const response = await callStats("", apiFetch);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("role.forbidden");
  });
});
