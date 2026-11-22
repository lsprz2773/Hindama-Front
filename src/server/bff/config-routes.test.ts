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
