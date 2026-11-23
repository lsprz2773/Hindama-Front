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
