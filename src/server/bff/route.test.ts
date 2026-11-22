// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zText } from "@/lib/api/zod";
import type { FetchLike } from "./cognito";
import { handleApiRoute, MAX_JSON_BODY_BYTES, type ApiRouteSpec } from "./route";
import { deps, ORIGIN, session, sessionCookie } from "./test-utils";

const PID = "0192e3a0-1111-7000-8000-000000000001";

const spec: ApiRouteSpec = {
  path: ["projects", { param: "projectId" }],
  query: z.strictObject({ page: z.coerce.number().int().min(1).max(10_000).optional() }),
  body: z.strictObject({ name: zText({ min: 1, max: 100 }) }),
  response: z.object({ id: z.string(), name: z.string() }),
};

function request(
  method: string,
  path: string,
  { body, headers = {} }: { body?: string; headers?: Record<string, string> } = {},
) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    body,
    headers: {
      cookie: sessionCookie(session()),
      origin: ORIGIN,
      "x-csrf-token": "csrf-token",
      "content-type": "application/json",
      ...headers,
    },
  });
}

function api(response: Response = Response.json({ id: PID, name: "Tienda" })) {
  return vi.fn<FetchLike>(async () => response.clone());
}

async function json(response: Response) {
  return (await response.json()) as { code: string; errors: { field: string; code: string }[] };
}

describe("route handler declarado del BFF", () => {
  it("reenvía a la ruta fija de la API con el cuerpo validado y recortado", async () => {
    const apiFetch = api();
    const response = await handleApiRoute(
      spec,
      request("PATCH", `/api/projects/${PID}?page=2`, { body: '{"name":"  Tienda  "}' }),
      { projectId: PID },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(200);
    const [url, init] = apiFetch.mock.calls[0];
    expect(url).toBe(`http://api.internal:8000/projects/${PID}?page=2`);
    expect(init.body).toBe('{"name":"Tienda"}');
  });

  it("devuelve solo los campos del contrato (descarta los desconocidos)", async () => {
    const apiFetch = api(Response.json({ id: PID, name: "T", credential: "secreto" }));
    const response = await handleApiRoute(
      { ...spec, body: undefined },
      request("GET", `/api/projects/${PID}`),
      { projectId: PID },
      deps({ apiFetch }),
    );
    expect(await response.json()).toEqual({ id: PID, name: "T" });
  });

  it("trata una respuesta fuera del contrato como error y no la entrega", async () => {
    const apiFetch = api(Response.json({ id: 42 }));
    const response = await handleApiRoute(
      { ...spec, body: undefined },
      request("GET", `/api/projects/${PID}`),
      { projectId: PID },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(502);
    expect((await json(response)).code).toBe("response.invalid");
  });

  it.each(["../admin", "..%2Fadmin", "abc", `${PID}/../../x`, "", "<script>"])(
    "rechaza el id %j sin llamar a la API",
    async (id) => {
      const apiFetch = api();
      const response = await handleApiRoute(
        { ...spec, body: undefined },
        request("GET", "/api/projects/x"),
        { projectId: id },
        deps({ apiFetch }),
      );
      expect(response.status).toBe(404);
      expect(apiFetch).not.toHaveBeenCalled();
    },
  );

  it("rechaza campos que el contrato no declara", async () => {
    const apiFetch = api();
    const response = await handleApiRoute(
      spec,
      request("PATCH", `/api/projects/${PID}`, { body: '{"name":"A","role":"admin"}' }),
      { projectId: PID },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(422);
    expect((await json(response)).code).toBe("validation.failed");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rechaza longitudes excesivas y caracteres de control junto al campo", async () => {
    const long = await handleApiRoute(
      spec,
      request("PATCH", `/api/projects/${PID}`, { body: JSON.stringify({ name: "a".repeat(101) }) }),
      { projectId: PID },
      deps({ apiFetch: api() }),
    );
    expect((await json(long)).errors).toEqual([
      { field: "name", code: "validation.length", message: "" },
    ]);
    const control = await handleApiRoute(
      spec,
      request("PATCH", `/api/projects/${PID}`, { body: JSON.stringify({ name: "a\u0000b" }) }),
      { projectId: PID },
      deps({ apiFetch: api() }),
    );
    expect((await json(control)).errors[0].code).toBe("validation.format");
  });

  it("rechaza parámetros de consulta no declarados o fuera de rango", async () => {
    for (const search of ["?page=0", "?page=99999", "?redirect=https://evil.test", "?page=x"]) {
      const apiFetch = api();
      const response = await handleApiRoute(
        { ...spec, body: undefined },
        request("GET", `/api/projects/${PID}${search}`),
        { projectId: PID },
        deps({ apiFetch }),
      );
      expect(response.status).toBe(422);
      expect(apiFetch).not.toHaveBeenCalled();
    }
  });

  it("rechaza un cuerpo que supera el máximo aunque mienta en Content-Length", async () => {
    const big = JSON.stringify({ name: "a".repeat(MAX_JSON_BODY_BYTES) });
    const response = await handleApiRoute(
      spec,
      request("PATCH", `/api/projects/${PID}`, { body: big, headers: { "content-length": "10" } }),
      { projectId: PID },
      deps({ apiFetch: api() }),
    );
    expect(response.status).toBe(413);
  });

  it("rechaza JSON mal formado o de otro tipo de contenido", async () => {
    const malformed = await handleApiRoute(
      spec,
      request("PATCH", `/api/projects/${PID}`, { body: "{nope" }),
      { projectId: PID },
      deps({ apiFetch: api() }),
    );
    expect(malformed.status).toBe(400);
    const form = await handleApiRoute(
      spec,
      request("PATCH", `/api/projects/${PID}`, {
        body: "name=a",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
      { projectId: PID },
      deps({ apiFetch: api() }),
    );
    expect(form.status).toBe(400);
  });

  it("comprueba CSRF y Origin antes de validar el cuerpo", async () => {
    const apiFetch = api();
    const response = await handleApiRoute(
      spec,
      request("PATCH", `/api/projects/${PID}`, {
        body: '{"extra":1}',
        headers: { origin: "https://evil.test" },
      }),
      { projectId: PID },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(403);
    expect((await json(response)).code).toBe("csrf.invalid");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sin sesión responde 401 sin llamar a la API", async () => {
    const apiFetch = api();
    const response = await handleApiRoute(
      { ...spec, body: undefined },
      new Request(`${ORIGIN}/api/projects/${PID}`),
      { projectId: PID },
      deps({ apiFetch }),
    );
    expect(response.status).toBe(401);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
