// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "./cognito";
import { handleApiRoute } from "./route";
import { SPECS } from "./specs";
import { cookiesFrom, deps, ORIGIN, session, sessionCookie } from "./test-utils";

/** Baja de cuenta (C-14, CU-25) y exportación de hallazgos a Excel (RF-77). */
const PID = "0192e3a0-2222-7000-8000-000000000001";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function request(method: string, path: string, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      cookie: sessionCookie(session()),
      origin: ORIGIN,
      ...(method === "GET" ? {} : { "x-csrf-token": "csrf-token" }),
      ...headers,
    },
  });
}

function problemResponse(status: number, code: string) {
  return Response.json(
    {
      type: `urn:hindama:error:${code}`,
      title: code,
      status,
      detail: "",
      code,
      request_id: "req-1",
      errors: [],
    },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

describe("deleteAccount (C-14)", () => {
  const call = (query: string, apiFetch: ReturnType<typeof vi.fn<FetchLike>>, headers = {}) =>
    handleApiRoute(
      SPECS.deleteAccount,
      request("DELETE", `/api/me${query}`, headers),
      {},
      deps({ apiFetch }),
    );

  it("reenvía el correo a la ruta fija y, con 204, borra la cookie de sesión", async () => {
    const apiFetch = vi.fn<FetchLike>(async () => new Response(null, { status: 204 }));
    const response = await call(`?confirmation=${encodeURIComponent("ana@ejemplo.mx")}`, apiFetch);
    expect(response.status).toBe(204);
    const url = new URL(String(apiFetch.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("http://api.internal:8000/me");
    expect(url.searchParams.get("confirmation")).toBe("ana@ejemplo.mx");
    expect(apiFetch.mock.calls[0][1]?.method).toBe("DELETE");
    const cleared = cookiesFrom(response).find((c) => c.startsWith("__Host-hindama_sesion="));
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Max-Age=0/i);
  });

  it.each([
    ["sin el correo", ""],
    ["un correo vacío", "?confirmation="],
    ["un correo con caracteres de control", "?confirmation=ana%0A@ejemplo.mx"],
    ["un correo de más de 254 caracteres", `?confirmation=${"a".repeat(255)}`],
    ["un parámetro desconocido", "?confirmation=ana@ejemplo.mx&force=true"],
  ])("rechaza %s sin llamar a la API", async (_label, query) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await call(query, apiFetch);
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sin el token CSRF no borra nada", async () => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await call("?confirmation=ana@ejemplo.mx", apiFetch, { "x-csrf-token": "" });
    expect(response.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it.each([
    [409, "account.active_run"],
    [422, "account.confirmation_mismatch"],
    [503, "account.deletion_incomplete"],
  ])("un %s (%s) pasa tal cual y conserva la sesión", async (status, code) => {
    const apiFetch = vi.fn<FetchLike>(async () => problemResponse(status, code));
    const response = await call("?confirmation=ana@ejemplo.mx", apiFetch);
    expect(response.status).toBe(status);
    expect((await response.json()).code).toBe(code);
    expect(cookiesFrom(response).some((c) => c.startsWith("__Host-hindama_sesion="))).toBe(false);
  });
});

describe("exportFindings (RF-77)", () => {
  const BOOK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
  const call = (query: string, apiFetch: ReturnType<typeof vi.fn<FetchLike>>) =>
    handleApiRoute(
      SPECS.exportFindings,
      request("GET", `/api/projects/${PID}/findings/export${query}`),
      { projectId: PID },
      deps({ apiFetch }),
    );

  it("reenvía los filtros, pide el libro y lo entrega con el nombre fijo", async () => {
    const apiFetch = vi.fn<FetchLike>(
      async () =>
        new Response(BOOK, {
          headers: {
            "content-type": XLSX,
            "content-disposition": 'attachment; filename="../../etc/passwd"',
          },
        }),
    );
    const response = await call(
      "?module=object_access&module=configuration&severity=critical&status=new&status=persistent",
      apiFetch,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(XLSX);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="hallazgos.xlsx"',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BOOK);
    const [url, init] = apiFetch.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe(
      `http://api.internal:8000/projects/${PID}/findings/export`,
    );
    expect(parsed.searchParams.getAll("module")).toEqual(["object_access", "configuration"]);
    expect(parsed.searchParams.getAll("status")).toEqual(["new", "persistent"]);
    expect(new Headers(init?.headers).get("accept")).toBe(XLSX);
  });

  it.each([
    ["la paginación", "page=1"],
    ["el tamaño de página", "page_size=20"],
    ["un parámetro desconocido", "q=jwt"],
    ["un módulo desconocido", "module=magia"],
  ])("rechaza %s sin llamar a la API", async (_label, query) => {
    const apiFetch = vi.fn<FetchLike>();
    const response = await call(`?${query}`, apiFetch);
    expect(response.status).toBe(422);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("trata una respuesta que no es un libro como error", async () => {
    const apiFetch = vi.fn<FetchLike>(async () => Response.json({ items: [] }));
    expect((await call("", apiFetch)).status).toBe(502);
  });

  it("deja pasar el 422 de demasiados hallazgos", async () => {
    const apiFetch = vi.fn<FetchLike>(async () => problemResponse(422, "finding.export_too_large"));
    const response = await call("", apiFetch);
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("finding.export_too_large");
  });
});
