import { describe, expect, it, vi } from "vitest";
import { ApiError, createHttpClient, CSRF_HEADER } from ".";

function respond(status: number, body?: unknown) {
  return vi.fn<typeof fetch>(
    async () => new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

function headersOf(call: unknown[]) {
  return (call[1] as RequestInit).headers as Record<string, string>;
}

describe("cliente HTTP central", () => {
  it("envía Accept-Language con el idioma activo en cada petición", async () => {
    let locale = "es";
    const fetchImpl = respond(200, { data: { ok: true } });
    const client = createHttpClient({ getLocale: () => locale, fetchImpl });

    await client.get("/projects");
    locale = "en";
    await client.get("/projects");

    expect(fetchImpl.mock.calls.map((c) => headersOf(c)["Accept-Language"])).toEqual(["es", "en"]);
  });

  it("añade el token anti-CSRF solo en peticiones que modifican datos", async () => {
    const fetchImpl = respond(200, {});
    const client = createHttpClient({
      getLocale: () => "es",
      getCsrfToken: () => "tok",
      fetchImpl,
    });

    await client.get("/projects");
    await client.post("/projects", { body: { name: "x" } });

    const [get, post] = fetchImpl.mock.calls.map((c) => headersOf(c));
    expect(get[CSRF_HEADER]).toBeUndefined();
    expect(post[CSRF_HEADER]).toBe("tok");
    expect(post["Content-Type"]).toBe("application/json");
  });

  it("construye la URL con query y devuelve datos y avisos", async () => {
    const fetchImpl = respond(200, { data: [1], warnings: [{ code: "url.no_tls" }] });
    const client = createHttpClient({ getLocale: () => "es", fetchImpl });

    const result = await client.get<number[]>("projects", { query: { page: 2, q: undefined } });

    expect(fetchImpl.mock.calls[0][0]).toBe("/api/projects?page=2");
    expect(result.data).toEqual([1]);
    expect(result.warnings).toEqual([{ code: "url.no_tls" }]);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [422, "validation"],
    [503, "server"],
  ])("traduce el estado %i al tipo %s", async (status, kind) => {
    const client = createHttpClient({ getLocale: () => "es", fetchImpl: respond(status, {}) });
    await expect(client.get("/x")).rejects.toMatchObject({ status, kind });
  });

  it("conserva código y errores por campo de la API", async () => {
    const body = { error: { code: "auth.invalid", fields: { email: "required" } } };
    const client = createHttpClient({ getLocale: () => "es", fetchImpl: respond(422, body) });
    const error = await client.post("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "auth.invalid", fields: { email: "required" } });
  });

  it("informa un error de red sin detalles internos", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const client = createHttpClient({ getLocale: () => "es", fetchImpl });
    await expect(client.get("/x")).rejects.toMatchObject({ kind: "network", status: 0 });
  });
});
