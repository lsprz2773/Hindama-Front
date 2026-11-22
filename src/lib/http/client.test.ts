import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { ApiError, createHttpClient, CSRF_HEADER, parseRetryAfter } from ".";

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

  it("construye la URL con query y devuelve el recurso sin sobre", async () => {
    const page = { items: [1], total: 1, page: 2, page_size: 20 };
    const fetchImpl = respond(200, page);
    const client = createHttpClient({ getLocale: () => "es", fetchImpl });

    const result = await client.get<typeof page>("projects", { query: { page: 2, q: undefined } });

    expect(fetchImpl.mock.calls[0][0]).toBe("/api/projects?page=2");
    expect(result.data).toEqual(page);
    expect(result.warnings).toEqual([]);
  });

  it("lee warnings[] del recurso con su code y su location (JSON Pointer)", async () => {
    const body = {
      id: "c1",
      warnings: [
        {
          code: "url.no_tls",
          message: "La URL usa HTTP: el tráfico y las credenciales de prueba viajarán sin cifrar.",
          location: null,
        },
        {
          code: "contract.external_reference",
          message: "Una $ref a otro archivo.",
          location: "/paths/~1orders/get",
        },
        { message: "sin código" },
      ],
    };
    const client = createHttpClient({ getLocale: () => "es", fetchImpl: respond(201, body) });

    const { warnings } = await client.post("/projects/p/contracts");

    expect(warnings).toEqual([
      {
        code: "url.no_tls",
        message: "La URL usa HTTP: el tráfico y las credenciales de prueba viajarán sin cifrar.",
        location: null,
      },
      {
        code: "contract.external_reference",
        message: "Una $ref a otro archivo.",
        location: "/paths/~1orders/get",
      },
    ]);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [400, "validation"],
    [405, "method_not_allowed"],
    [409, "conflict"],
    [413, "too_large"],
    [422, "validation"],
    [429, "rate_limited"],
    [500, "server"],
    [503, "server"],
  ])("traduce el estado %i al tipo %s", async (status, kind) => {
    const client = createHttpClient({
      getLocale: () => "es",
      fetchImpl: respond(status, {}),
      getRetries: 0,
    });
    await expect(client.get("/x")).rejects.toMatchObject({ status, kind });
  });

  it("lee un 422 validation.failed con dos errores de campo (Problem Details)", async () => {
    const body = {
      type: "urn:hindama:error:validation.failed",
      title: "La petición no es válida",
      status: 422,
      detail: "Uno o más campos no son válidos.",
      code: "validation.failed",
      request_id: "0192e3b1-7c1a-7d40-9f5e-1b2c3d4e5f60",
      errors: [
        { field: "name", code: "validation.required", message: "Campo obligatorio." },
        { field: "credential.value", code: "validation.length", message: "Demasiado largo." },
      ],
    };
    const client = createHttpClient({ getLocale: () => "es", fetchImpl: respond(422, body) });

    const error = (await client.post("/x").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      kind: "validation",
      code: "validation.failed",
      requestId: "0192e3b1-7c1a-7d40-9f5e-1b2c3d4e5f60",
      fields: { name: ["validation.required"], "credential.value": ["validation.length"] },
      general: [],
    });
    expect(error.fieldCode("credential.value")).toBe("validation.length");
    expect(error.fieldCode("base_url")).toBeUndefined();
  });

  it("separa los errores con field null en la lista general", async () => {
    const body = {
      code: "contract.invalid",
      request_id: "r1",
      errors: [
        { field: "/paths/~1orders/get/responses", code: "contract.required_field", message: "x" },
        { field: null, code: "contract.empty", message: "y" },
      ],
    };
    const client = createHttpClient({ getLocale: () => "es", fetchImpl: respond(422, body) });

    const error = (await client.post("/x").catch((e: unknown) => e)) as ApiError;

    expect(error.fields).toEqual({ "/paths/~1orders/get/responses": ["contract.required_field"] });
    expect(error.general).toEqual(["contract.empty"]);
  });

  it("lee un 500 con code internal y conserva request_id sin detalles internos", async () => {
    const body = {
      type: "urn:hindama:error:internal",
      title: "Error interno",
      status: 500,
      detail: "Ocurrió un error inesperado.",
      code: "internal",
      request_id: "0192e3b1-0000-7000-8000-000000000500",
      errors: [],
    };
    const client = createHttpClient({
      getLocale: () => "es",
      fetchImpl: respond(500, body),
      getRetries: 0,
    });

    const error = (await client.get("/x").catch((e: unknown) => e)) as ApiError;

    expect(error).toMatchObject({
      status: 500,
      kind: "server",
      code: "internal",
      requestId: "0192e3b1-0000-7000-8000-000000000500",
      fields: {},
      general: [],
    });
  });

  it("lee un 401 auth.invalid_token", async () => {
    const body = {
      type: "urn:hindama:error:auth.invalid_token",
      title: "Token inválido",
      status: 401,
      detail: "El token venció o no es válido.",
      code: "auth.invalid_token",
      request_id: "r-401",
      errors: [],
    };
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(body), {
          status: 401,
          headers: { "WWW-Authenticate": "Bearer", "Content-Type": "application/problem+json" },
        }),
    );
    const client = createHttpClient({ getLocale: () => "es", fetchImpl });

    await expect(client.get("/me")).rejects.toMatchObject({
      status: 401,
      kind: "unauthorized",
      code: "auth.invalid_token",
      requestId: "r-401",
    });
  });

  it("lee Retry-After en un 429 y Allow en un 405", async () => {
    const tooMany = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ code: "rate_limit.exceeded", request_id: "r", errors: [] }), {
          status: 429,
          headers: { "Retry-After": "42" },
        }),
    );
    const notAllowed = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ code: "request.method_not_allowed", request_id: "r", errors: [] }),
          { status: 405, headers: { Allow: "GET, POST" } },
        ),
    );

    await expect(
      createHttpClient({ getLocale: () => "es", fetchImpl: tooMany, getRetries: 0 }).get("/x"),
    ).rejects.toMatchObject({ kind: "rate_limited", retryAfter: 42, code: "rate_limit.exceeded" });
    await expect(
      createHttpClient({ getLocale: () => "es", fetchImpl: notAllowed }).post("/x"),
    ).rejects.toMatchObject({ kind: "method_not_allowed", allow: ["GET", "POST"] });
  });

  it("acepta Retry-After como fecha HTTP", () => {
    const now = Date.parse("2026-11-22T08:00:00Z");
    expect(parseRetryAfter("Sun, 22 Nov 2026 08:00:30 GMT", now)).toBe(30);
    expect(parseRetryAfter("basura", now)).toBeUndefined();
    expect(parseRetryAfter(null, now)).toBeUndefined();
  });

  it("informa un error de red sin detalles internos", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const client = createHttpClient({ getLocale: () => "es", fetchImpl, getRetries: 0 });
    await expect(client.get("/x")).rejects.toMatchObject({ kind: "network", status: 0 });
  });

  it("reintenta un GET ante un 503 con espera creciente y luego responde", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const sleep = vi.fn(async () => {});
    const client = createHttpClient({ getLocale: () => "es", fetchImpl, sleep });

    const result = await client.get("/projects");

    expect(result.data).toEqual({ ok: true });
    expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([500, 1000]);
  });

  it("respeta Retry-After al reintentar un GET con 429", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "rate_limit.exceeded" }), {
          status: 429,
          headers: { "Retry-After": "3" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const sleep = vi.fn(async () => {});
    const client = createHttpClient({ getLocale: () => "es", fetchImpl, sleep });

    await client.get("/x");

    expect(sleep).toHaveBeenCalledWith(3000, undefined);
  });

  it("nunca reintenta una petición que modifica datos", async () => {
    const fetchImpl = respond(503, {});
    const sleep = vi.fn(async () => {});
    const client = createHttpClient({ getLocale: () => "es", fetchImpl, sleep });

    await expect(client.post("/projects", { body: {} })).rejects.toMatchObject({ status: 503 });
    await expect(client.delete("/projects/x")).rejects.toMatchObject({ status: 503 });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("no reintenta errores definitivos (404, 422)", async () => {
    const fetchImpl = respond(404, { code: "resource.not_found" });
    const client = createHttpClient({ getLocale: () => "es", fetchImpl, sleep: async () => {} });
    await expect(client.get("/x")).rejects.toMatchObject({ kind: "not_found" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("corta la petición al agotar el tiempo máximo", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("t", "TimeoutError")),
          );
        }),
    );
    const client = createHttpClient({
      getLocale: () => "es",
      fetchImpl,
      timeoutMs: 20,
      getRetries: 0,
    });
    await expect(client.get("/x")).rejects.toMatchObject({
      kind: "network",
      code: "request.timeout",
    });
  });

  it("propaga la cancelación de la vista sin reintentar", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("a", "AbortError")),
          );
        }),
    );
    const client = createHttpClient({ getLocale: () => "es", fetchImpl });
    const pending = client.get("/x", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("repite el parámetro de un filtro con varios valores", async () => {
    const fetchImpl = respond(200, {});
    const client = createHttpClient({ getLocale: () => "es", fetchImpl });
    await client.get("/f", { query: { status: ["new", "persistent"], page: 1 } });
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/f?status=new&status=persistent&page=1");
  });

  it("rechaza una respuesta que no cumple el esquema y no la entrega", async () => {
    const schema = z.object({ id: z.string() });
    const client = createHttpClient({ getLocale: () => "es", fetchImpl: respond(200, { id: 1 }) });
    await expect(client.read("/x", schema)).rejects.toMatchObject({
      kind: "invalid_response",
      code: "response.invalid",
    });
  });

  it("descarta los campos que el esquema no conoce", async () => {
    const schema = z.object({ id: z.string() });
    const client = createHttpClient({
      getLocale: () => "es",
      fetchImpl: respond(200, { id: "a", extra: "<script>" }),
    });
    const { data } = await client.read("/x", schema);
    expect(data).toEqual({ id: "a" });
  });
});
