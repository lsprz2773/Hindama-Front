// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { projectCreateSchema, projectUpdateSchema } from "@/lib/api/schemas/projects";
import type { FetchLike } from "./cognito";
import { handleApiRoute } from "./route";
import { SPECS } from "./specs";
import { deps, ORIGIN, session, sessionCookie } from "./test-utils";

const PID = "0192e3a0-2222-7000-8000-000000000001";

const SUMMARY = {
  id: PID,
  name: "API de pedidos",
  base_url: "https://api.tienda-ejemplo.com/v1",
  verification_status: "verified",
  concluded: false,
  last_run_at: null,
  open_findings: 5,
  created_at: "2026-11-02T15:00:00Z",
};

const ZERO = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };

const PROJECT = {
  id: PID,
  name: "API de pedidos",
  description: null,
  base_url: "https://api.tienda-ejemplo.com/v1",
  host: "api.tienda-ejemplo.com",
  verification_status: "pending",
  verified_at: null,
  concluded: false,
  current_contract: null,
  last_run: null,
  open_findings_by_severity: ZERO,
  modules: [],
  warnings: [],
  created_at: "2026-11-02T15:00:00Z",
  updated_at: "2026-11-02T15:00:00Z",
};

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

function api(response: Response) {
  return vi.fn<FetchLike>(async () => response.clone());
}

describe("listProjects", () => {
  it("reenvía la paginación y el orden permitidos", async () => {
    const apiFetch = api(Response.json({ items: [SUMMARY], total: 1, page: 2, page_size: 10 }));
    const response = await handleApiRoute(
      SPECS.listProjects,
      request("GET", "/api/projects?page=2&page_size=10&sort=-last_run_at"),
      {},
      deps({ apiFetch }),
    );
    expect(response.status).toBe(200);
    expect(String(apiFetch.mock.calls[0][0])).toBe(
      "http://api.internal:8000/projects?page=2&page_size=10&sort=-last_run_at",
    );
  });

  it.each([
    ["un parámetro no declarado (búsqueda por texto)", "q=pedidos"],
    ["página fuera de rango", "page=0"],
    ["tamaño de página excesivo", "page_size=1000"],
    ["orden no permitido", "sort=password"],
    ["página no numérica", "page=1;DROP"],
  ])("rechaza %s sin llamar a la API", async (_label, search) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.listProjects,
      request("GET", `/api/projects?${search}`),
      {},
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("una respuesta fuera del contrato es un error, no se pinta", async () => {
    const apiFetch = api(Response.json({ items: [{ ...SUMMARY, open_findings: "5" }] }));
    const response = await handleApiRoute(
      SPECS.listProjects,
      request("GET", "/api/projects"),
      {},
      deps({ apiFetch }),
    );
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("response.invalid");
  });
});

describe("createProject", () => {
  it("envía el cuerpo recortado y la descripción vacía como null", async () => {
    const apiFetch = api(Response.json(PROJECT, { status: 201 }));
    const response = await handleApiRoute(
      SPECS.createProject,
      request("POST", "/api/projects", {
        body: { name: "  API de pedidos ", description: "   ", base_url: "https://api.x.mx/v1" },
      }),
      {},
      deps({ apiFetch }),
    );
    expect(response.status).toBe(201);
    expect(JSON.parse(String(apiFetch.mock.calls[0][1].body))).toEqual({
      name: "API de pedidos",
      description: null,
      base_url: "https://api.x.mx/v1",
    });
  });

  it.each([
    ["campos extra", { name: "A", base_url: "https://a.mx", verification_status: "verified" }],
    ["nombre vacío", { name: "   ", base_url: "https://a.mx" }],
    ["nombre largo", { name: "a".repeat(101), base_url: "https://a.mx" }],
    ["nombre con control", { name: "A\u0000B", base_url: "https://a.mx" }],
    ["descripción larga", { name: "A", description: "d".repeat(501), base_url: "https://a.mx" }],
    ["esquema no permitido", { name: "A", base_url: "javascript:alert(1)" }],
    ["esquema file", { name: "A", base_url: "file:///etc/passwd" }],
    ["usuario en la URL", { name: "A", base_url: "https://user:pw@a.mx" }],
    ["fragmento", { name: "A", base_url: "https://a.mx/#x" }],
    ["URL larga", { name: "A", base_url: `https://a.mx/${"a".repeat(2050)}` }],
  ])("rechaza %s sin llamar a la API", async (_label, body) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.createProject,
      request("POST", "/api/projects", { body }),
      {},
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sin token anti-CSRF no crea nada", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.createProject,
      request("POST", "/api/projects", {
        body: { name: "A", base_url: "https://a.mx" },
        headers: { "x-csrf-token": "" },
      }),
      {},
      deps({ apiFetch }),
    );
    expect(response.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("getProject, updateProject y deleteProject", () => {
  it("un id que no es UUID responde 404 sin llamar a la API", async () => {
    const apiFetch = vi.fn<FetchLike>();
    for (const projectId of ["pedidos", "../me", `${PID}/../../admin`]) {
      const response = await handleApiRoute(
        SPECS.getProject,
        request("GET", `/api/projects/${encodeURIComponent(projectId)}`),
        { projectId },
        deps({ apiFetch }),
      );
      expect(response.status).toBe(404);
    }
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("editar exige al menos un campo", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.updateProject,
      request("PATCH", `/api/projects/${PID}`, { body: {} }),
      { projectId: PID },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("eliminar envía la confirmación sin recortar y sin cuerpo", async () => {
    const apiFetch = api(new Response(null, { status: 204 }));
    const response = await handleApiRoute(
      SPECS.deleteProject,
      request("DELETE", `/api/projects/${PID}?confirmation=${encodeURIComponent(" API & co")}`),
      { projectId: PID },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(204);
    const [url, init] = apiFetch.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("confirmation")).toBe(" API & co");
    expect(init.method).toBe("DELETE");
  });

  it("eliminar sin confirmación o con caracteres de control se rechaza", async () => {
    const apiFetch = vi.fn<FetchLike>();
    for (const search of ["", "?confirmation=", "?confirmation=%00"]) {
      const response = await handleApiRoute(
        SPECS.deleteProject,
        request("DELETE", `/api/projects/${PID}${search}`),
        { projectId: PID },
        deps({ apiFetch }),
      );
      expect(response.status).toBe(422);
    }
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("esquemas de entrada en el navegador", () => {
  it("la URL base acepta puerto y ruta", () => {
    expect(
      projectCreateSchema.safeParse({ name: "A", base_url: "http://api.mx:8080/v1" }).success,
    ).toBe(true);
  });

  it("los errores usan los códigos de la API", () => {
    const result = projectCreateSchema.safeParse({ name: "", base_url: "ftp://a.mx" });
    expect(result.success).toBe(false);
    const codes = result.error!.issues.map((i) => [i.path.join("."), i.message]);
    expect(codes).toEqual([
      ["name", "validation.required"],
      ["base_url", "url.scheme_not_allowed"],
    ]);
  });

  it("editar no admite campos fuera del contrato", () => {
    expect(projectUpdateSchema.safeParse({ host: "a.mx" }).success).toBe(false);
  });
});
