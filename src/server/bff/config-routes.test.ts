// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "./cognito";
import { handleApiRoute } from "./route";
import { SPECS } from "./specs";
import { deps, ORIGIN, session, sessionCookie } from "./test-utils";

/** Rutas del BFF de la configuración de un proyecto (fase 4). */
const PID = "0192e3a0-2222-7000-8000-000000000001";
const params = { projectId: PID };

const VERIFICATION = {
  status: "pending",
  host: "api.tienda-ejemplo.com",
  code: "hindama-7Q4K-M2XP-9C1L-TR83",
  method: null,
  verified_at: null,
  file: {
    url: "https://api.tienda-ejemplo.com/.well-known/hindama-verificacion.txt",
    content: "hindama-7Q4K-M2XP-9C1L-TR83",
  },
  dns: {
    name: "_hindama-verificacion.api.tienda-ejemplo.com",
    type: "TXT",
    value: "hindama-7Q4K-M2XP-9C1L-TR83",
  },
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

describe("verificación (V-18)", () => {
  it("getVerification pide la ruta del proyecto y valida la respuesta", async () => {
    const apiFetch = api(Response.json(VERIFICATION));
    const response = await handleApiRoute(
      SPECS.getVerification,
      request("GET", `/api/projects/${PID}/verification`),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(200);
    expect(String(apiFetch.mock.calls[0][0])).toBe(
      `http://api.internal:8000/projects/${PID}/verification`,
    );
  });

  it("verifyOwnership solo envía el método", async () => {
    const apiFetch = api(Response.json({ ...VERIFICATION, status: "verified", method: "dns" }));
    const response = await handleApiRoute(
      SPECS.verifyOwnership,
      request("POST", `/api/projects/${PID}/verification`, { body: { method: "dns" } }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(String(apiFetch.mock.calls[0][1].body))).toEqual({ method: "dns" });
  });

  it.each([
    ["un método desconocido", { method: "http" }],
    ["campos extra", { method: "file", host: "169.254.169.254" }],
    ["sin método", {}],
  ])("rechaza %s sin llamar a la API", async (_label, body) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.verifyOwnership,
      request("POST", `/api/projects/${PID}/verification`, { body }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sin el token CSRF no verifica", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.verifyOwnership,
      request("POST", `/api/projects/${PID}/verification`, {
        body: { method: "file" },
        headers: { "x-csrf-token": "" },
      }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("un 422 conserva `found` acotado y nada más del cuerpo de la API", async () => {
    const apiFetch = api(
      Response.json(
        {
          type: "urn:hindama:error:verification.content_mismatch",
          title: "El archivo no contiene el código",
          status: 422,
          detail: "No coincide.",
          code: "verification.content_mismatch",
          request_id: "req-1",
          errors: [],
          found: `HTTP 200: ${"x".repeat(500)}`,
          stack: "Traceback (most recent call last)",
        },
        { status: 422, headers: { "content-type": "application/problem+json" } },
      ),
    );
    const response = await handleApiRoute(
      SPECS.verifyOwnership,
      request("POST", `/api/projects/${PID}/verification`, { body: { method: "file" } }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("verification.content_mismatch");
    expect(body.found).toHaveLength(200);
    expect(body).not.toHaveProperty("stack");
  });

  it("un id que no es UUID responde 404 sin llamar a la API", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.getVerification,
      request("GET", "/api/projects/..%2Fadmin/verification"),
      { projectId: "../admin" },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(404);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

const CONTRACT = {
  id: "0192e3a0-3333-7000-8000-000000000003",
  number: 3,
  source: "file",
  openapi_version: "3.1.0",
  operation_count: 18,
  imported_at: "2026-11-04T10:00:00Z",
  source_url: null,
  file_name: "pedidos.yaml",
  format: "yaml",
  api_title: "Pedidos",
  sha256: "ab".repeat(32),
  is_current: true,
  warnings: [],
  changes: null,
};

function formRequest(form: FormData, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/projects/${PID}/contracts`, {
    method: "POST",
    body: form,
    headers: {
      cookie: sessionCookie(session()),
      origin: ORIGIN,
      "x-csrf-token": "csrf-token",
      ...headers,
    },
  });
}

function yamlFile(name = "pedidos.yaml", size = 40, type = "application/x-yaml") {
  return new File(["o".repeat(size)], name, { type });
}

describe("importContract (V-19)", () => {
  it("reenvía un formulario nuevo con solo el archivo validado", async () => {
    const apiFetch = api(Response.json(CONTRACT, { status: 201 }));
    const form = new FormData();
    form.set("file", yamlFile());
    const response = await handleApiRoute(
      SPECS.importContract,
      formRequest(form),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(201);
    const sent = apiFetch.mock.calls[0][1].body as FormData;
    expect(sent).toBeInstanceOf(FormData);
    expect([...sent.keys()]).toEqual(["file"]);
    expect((sent.get("file") as File).name).toBe("pedidos.yaml");
  });

  it("acepta una URL pública", async () => {
    const apiFetch = api(Response.json(CONTRACT, { status: 201 }));
    const form = new FormData();
    form.set("url", " https://docs.tienda.mx/openapi.json ");
    const response = await handleApiRoute(
      SPECS.importContract,
      formRequest(form),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(201);
    expect((apiFetch.mock.calls[0][1].body as FormData).get("url")).toBe(
      "https://docs.tienda.mx/openapi.json",
    );
  });

  it.each([
    ["sin archivo ni URL", () => new FormData(), "contract.source_required"],
    [
      "archivo y URL a la vez",
      () => {
        const f = new FormData();
        f.set("file", yamlFile());
        f.set("url", "https://a.mx/openapi.json");
        return f;
      },
      "contract.source_required",
    ],
    [
      "un campo extra",
      () => {
        const f = new FormData();
        f.set("url", "https://a.mx/openapi.json");
        f.set("project_id", "otro");
        return f;
      },
      "validation.format",
    ],
    [
      "un tipo de archivo no permitido",
      () => {
        const f = new FormData();
        f.set("file", yamlFile("shell.php", 40, "application/x-php"));
        return f;
      },
      "contract.invalid_type",
    ],
    [
      "un archivo vacío",
      () => {
        const f = new FormData();
        f.set("file", yamlFile("vacio.json", 0, "application/json"));
        return f;
      },
      "validation.required",
    ],
    [
      "una URL con otro esquema",
      () => {
        const f = new FormData();
        f.set("url", "file:///etc/passwd");
        return f;
      },
      "url.scheme_not_allowed",
    ],
    [
      "una URL con credenciales",
      () => {
        const f = new FormData();
        f.set("url", "https://user:pw@a.mx/openapi.json");
        return f;
      },
      "url.invalid_format",
    ],
  ])("rechaza %s sin llamar a la API", async (_label, build, code) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.importContract,
      formRequest(build()),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).errors[0].code).toBe(code);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rechaza un documento de más de 5 MB con 413", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const form = new FormData();
    form.set("file", yamlFile("grande.yaml", 5 * 1024 * 1024 + 70 * 1024));
    const response = await handleApiRoute(
      SPECS.importContract,
      formRequest(form),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(413);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rechaza un cuerpo JSON en lugar del formulario", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.importContract,
      request("POST", `/api/projects/${PID}/contracts`, { body: { url: "https://a.mx" } }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(400);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("contratos y operaciones", () => {
  it("getContract exige UUID en las dos partes de la ruta", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.getContract,
      request("GET", `/api/projects/${PID}/contracts/3`),
      { projectId: PID, contractId: "3" },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(404);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("listOperations solo reenvía los filtros del contrato", async () => {
    const apiFetch = api(Response.json({ items: [], total: 0, page: 1, page_size: 500 }));
    await handleApiRoute(
      SPECS.listOperations,
      request("GET", `/api/projects/${PID}/operations?page_size=500&include_retired=true`),
      params,
      deps({ apiFetch }),
    );
    expect(String(apiFetch.mock.calls[0][0])).toBe(
      `http://api.internal:8000/projects/${PID}/operations?page_size=500&include_retired=true`,
    );
    const rejected = await handleApiRoute(
      SPECS.listOperations,
      request("GET", `/api/projects/${PID}/operations?method=CONNECT`),
      params,
      deps({ apiFetch: vi.fn<FetchLike>() }),
    );
    expect(rejected.status).toBe(422);
  });

  it.each([
    ["sin cambios", {}],
    ["una plantilla desconocida", { policy: "root" }],
    ["un campo de propietario con control", { owner_field: "id\u0007" }],
    [
      "demasiados parámetros",
      { resource_parameters: Array(21).fill({ name: "a", resource_type: "b" }) },
    ],
    ["campos extra", { policy: "public", confirmed_at: "2026-01-01T00:00:00Z" }],
  ])("updateOperation rechaza %s", async (_label, body) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.updateOperation,
      request("PATCH", `/api/projects/${PID}/operations/${PID}`, { body }),
      { projectId: PID, operationId: PID },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["ids repetidos", { operation_ids: [PID, PID], policy: "public" }],
    ["un id que no es UUID", { operation_ids: ["1 OR 1=1"], policy: "public" }],
    ["sin operaciones", { operation_ids: [], policy: "public" }],
  ])("applyPolicy rechaza %s", async (_label, body) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.applyPolicy,
      request("POST", `/api/projects/${PID}/policy`, { body }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

const IID = "0192e3a0-6666-7000-8000-000000000002";
const OP = "0192e3a0-5555-7000-8000-000000000001";
const IDENTITY = {
  id: IID,
  name: "Cliente A",
  role: "user",
  role_label: null,
  auth_type: "bearer",
  credential_suffix: "x9Qk",
  field_name: null,
  login_operation: null,
  status: "active",
  last_tested_at: null,
  last_test_status_code: null,
  resource_count: 0,
  warnings: [],
  created_at: "2026-11-04T10:00:00Z",
};
const identityParams = { projectId: PID, identityId: IID };
const SECRET = ["tok", "en-de-prueba", "-123"].join("");

describe("identidades (V-21 y V-22)", () => {
  it("createIdentity reenvía la credencial sin recortarla y no la devuelve", async () => {
    const apiFetch = api(
      Response.json({ ...IDENTITY, credential: { token: SECRET } }, { status: 201 }),
    );
    const response = await handleApiRoute(
      SPECS.createIdentity,
      request("POST", `/api/projects/${PID}/identities`, {
        body: {
          name: " Cliente A ",
          role: "user",
          auth_type: "bearer",
          credential: { token: ` ${SECRET}` },
        },
      }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(201);
    const sent = JSON.parse(String(apiFetch.mock.calls[0][1].body));
    expect(sent).toEqual({
      name: "Cliente A",
      role: "user",
      auth_type: "bearer",
      credential: { token: ` ${SECRET}` },
    });
    // Aunque la API la devolviera por error, el esquema de respuesta la descarta.
    expect(JSON.stringify(await response.json())).not.toContain(SECRET);
  });

  it.each([
    [
      "una credencial que no corresponde al tipo",
      { auth_type: "login", credential: { token: "t" }, login_operation_id: OP },
    ],
    ["cookie sin nombre de campo", { auth_type: "cookie", credential: { value: "v" } }],
    [
      "login sin operación de login",
      { auth_type: "login", credential: { username: "u", password: "p" } },
    ],
    [
      "una cabecera con un nombre no válido",
      { auth_type: "header", credential: { value: "v" }, field_name: "X-Api Key" },
    ],
    [
      "una credencial con caracteres de control",
      { auth_type: "bearer", credential: { token: "a\r\nInjected: 1" } },
    ],
    ["una credencial larga", { auth_type: "bearer", credential: { token: "t".repeat(4097) } }],
    ["el tipo anónimo", { auth_type: "none", credential: { token: "t" } }],
    [
      "campos extra en la credencial",
      { auth_type: "bearer", credential: { token: "t", scope: "admin" } },
    ],
  ])("createIdentity rechaza %s sin llamar a la API", async (_label, extra) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.createIdentity,
      request("POST", `/api/projects/${PID}/identities`, {
        body: { name: "Cliente A", role: "user", ...extra },
      }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("updateIdentity exige la credencial al cambiar el tipo", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.updateIdentity,
      request("PATCH", `/api/projects/${PID}/identities/${IID}`, { body: { auth_type: "cookie" } }),
      identityParams,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).errors[0].code).toBe("identity.credential_required");
  });

  it("testIdentity y deleteIdentity usan la ruta de la identidad", async () => {
    const apiFetch = api(
      Response.json({
        succeeded: false,
        status_code: 401,
        failure: "rejected",
        operation: { id: OP, method: "GET", path: "/me" },
        tested_at: "2026-11-04T10:00:00Z",
      }),
    );
    const tested = await handleApiRoute(
      SPECS.testIdentity,
      request("POST", `/api/projects/${PID}/identities/${IID}/test`, { body: {} }),
      identityParams,
      deps({ apiFetch }),
    );
    expect(tested.status).toBe(200);
    expect(String(apiFetch.mock.calls[0][0])).toBe(
      `http://api.internal:8000/projects/${PID}/identities/${IID}/test`,
    );

    const deleteFetch = api(new Response(null, { status: 204 }));
    const deleted = await handleApiRoute(
      SPECS.deleteIdentity,
      request("DELETE", `/api/projects/${PID}/identities/${IID}`),
      identityParams,
      deps({ apiFetch: deleteFetch }),
    );
    expect(deleted.status).toBe(204);
  });

  it("un id de identidad que no es UUID responde 404", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.deleteIdentity,
      request("DELETE", `/api/projects/${PID}/identities/cliente-a`),
      { projectId: PID, identityId: "cliente-a" },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(404);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

const RID = "0192e3a0-8888-7000-8000-000000000001";
const RESOURCE = {
  id: RID,
  identity_id: IID,
  resource_type: "pedido",
  value: "101",
  source: "manual",
  confirmed: true,
  created_at: "2026-11-04T10:00:00Z",
};
const resourceParams = { projectId: PID, resourceId: RID };

describe("recursos (V-23)", () => {
  it("listResources reenvía el filtro por identidad y valida la página", async () => {
    const apiFetch = api(Response.json({ items: [RESOURCE], total: 1, page: 1, page_size: 100 }));
    const response = await handleApiRoute(
      SPECS.listResources,
      request("GET", `/api/projects/${PID}/resources?identity_id=${IID}&page_size=100`),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(200);
    expect(String(apiFetch.mock.calls[0][0])).toBe(
      `http://api.internal:8000/projects/${PID}/resources?page_size=100&identity_id=${IID}`,
    );
  });

  it.each([
    ["un identity_id que no es UUID", "identity_id=cliente-a"],
    ["un page_size mayor que 100", "page_size=101"],
    ["un tipo con caracteres de control", "resource_type=pe%0Adido"],
    ["un parámetro desconocido", "owner=otro"],
  ])("listResources rechaza %s sin llamar a la API", async (_label, query) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.listResources,
      request("GET", `/api/projects/${PID}/resources?${query}`),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("listResources trata una respuesta inválida como error", async () => {
    const apiFetch = api(
      Response.json({
        items: [{ ...RESOURCE, source: "magia" }],
        total: 1,
        page: 1,
        page_size: 20,
      }),
    );
    const response = await handleApiRoute(
      SPECS.listResources,
      request("GET", `/api/projects/${PID}/resources`),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(502);
  });

  it("createResource recorta y normaliza el identificador", async () => {
    const apiFetch = api(Response.json(RESOURCE, { status: 201 }));
    const response = await handleApiRoute(
      SPECS.createResource,
      request("POST", `/api/projects/${PID}/resources`, {
        body: { identity_id: IID, resource_type: " pedido ", value: " 101 " },
      }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(201);
    expect(JSON.parse(String(apiFetch.mock.calls[0][1].body))).toEqual({
      identity_id: IID,
      resource_type: "pedido",
      value: "101",
    });
  });

  it.each([
    ["sin identificador", { identity_id: IID, resource_type: "pedido", value: " " }],
    [
      "un identificador largo",
      { identity_id: IID, resource_type: "pedido", value: "1".repeat(501) },
    ],
    [
      "un identificador con control",
      { identity_id: IID, resource_type: "pedido", value: "1\u0000" },
    ],
    ["una identidad que no es UUID", { identity_id: "a", resource_type: "pedido", value: "1" }],
    [
      "campos extra",
      { identity_id: IID, resource_type: "pedido", value: "1", source: "discovered" },
    ],
  ])("createResource rechaza %s sin llamar a la API", async (_label, body) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.createResource,
      request("POST", `/api/projects/${PID}/resources`, { body }),
      params,
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("updateResource confirma y rechaza un cuerpo vacío", async () => {
    const apiFetch = api(Response.json(RESOURCE));
    const confirmed = await handleApiRoute(
      SPECS.updateResource,
      request("PATCH", `/api/projects/${PID}/resources/${RID}`, { body: { confirmed: true } }),
      resourceParams,
      deps({ apiFetch }),
    );
    expect(confirmed.status).toBe(200);
    expect(String(apiFetch.mock.calls[0][0])).toBe(
      `http://api.internal:8000/projects/${PID}/resources/${RID}`,
    );

    const emptyFetch = vi.fn<FetchLike>();
    const empty = await handleApiRoute(
      SPECS.updateResource,
      request("PATCH", `/api/projects/${PID}/resources/${RID}`, { body: {} }),
      resourceParams,
      deps({ apiFetch: emptyFetch }),
    );
    expect(empty.status).toBe(422);
    expect(emptyFetch).not.toHaveBeenCalled();
  });

  it("deleteResource rechaza un id que no es UUID", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await handleApiRoute(
      SPECS.deleteResource,
      request("DELETE", `/api/projects/${PID}/resources/..%2Fidentities`),
      { projectId: PID, resourceId: "../identities" },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(404);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
