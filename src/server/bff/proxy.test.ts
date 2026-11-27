// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { secretHash } from "./cognito";
import type { FetchLike } from "./cognito";
import { apiPath, proxyToApi, toBffLocation } from "./proxy";
import { readSession } from "./session";
import { parseCookieHeader } from "./cookies";
import {
  cognitoTokens,
  CONFIG,
  cookiesFrom,
  deps,
  jwt,
  KEY,
  nowSeconds,
  ORIGIN,
  session,
  sessionCookie,
} from "./test-utils";

function browserRequest(
  method: string,
  path: string,
  {
    headers = {},
    body,
    cookie = sessionCookie(session()),
  }: {
    headers?: Record<string, string>;
    body?: string;
    cookie?: string | null;
  } = {},
) {
  const h = new Headers(headers);
  if (cookie) h.set("cookie", cookie);
  return new Request(`${ORIGIN}${path}`, { method, headers: h, body });
}

const safe = { origin: ORIGIN, "x-csrf-token": "csrf-token", "content-type": "application/json" };

function apiReturning(...responses: Response[]) {
  const queue = [...responses];
  return vi.fn<FetchLike>(async () => queue.shift() ?? new Response(null, { status: 204 }));
}

function sentHeaders(fetchMock: ReturnType<typeof apiReturning>, call = 0) {
  return new Headers(fetchMock.mock.calls[call][1].headers);
}

describe("CSRF y Origin en peticiones que modifican datos (RNF-07)", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "%s sin Origin se rechaza con 403",
    async (method) => {
      const apiFetch = apiReturning();
      const response = await proxyToApi(
        browserRequest(method, "/api/projects", { headers: { "x-csrf-token": "csrf-token" } }),
        "/projects",
        deps({ apiFetch }),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "csrf.invalid" });
      expect(apiFetch).not.toHaveBeenCalled();
    },
  );

  it("rechaza otro Origin aunque el token sea correcto", async () => {
    const apiFetch = apiReturning();
    const response = await proxyToApi(
      browserRequest("POST", "/api/projects", {
        headers: { ...safe, origin: "https://evil.test" },
        body: "{}",
      }),
      "/projects",
      deps({ apiFetch }),
    );
    expect(response.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rechaza un token ausente o distinto al de la sesión", async () => {
    for (const token of [undefined, "otro-token"]) {
      const headers: Record<string, string> = { origin: ORIGIN };
      if (token) headers["x-csrf-token"] = token;
      const response = await proxyToApi(
        browserRequest("DELETE", "/api/projects/p", { headers }),
        "/projects/p",
        deps(),
      );
      expect(response.status).toBe(403);
    }
  });

  it("GET no exige token anti-CSRF", async () => {
    const apiFetch = apiReturning(Response.json({ items: [] }));
    const response = await proxyToApi(
      browserRequest("GET", "/api/projects"),
      "/projects",
      deps({ apiFetch }),
    );
    expect(response.status).toBe(200);
  });
});

describe("reenvío a la API (guía del frontend, sección 4)", () => {
  it("agrega Bearer, X-Hindama-Client-IP, X-Request-Id y Accept-Language", async () => {
    const apiFetch = apiReturning(
      Response.json({ id: "p" }, { status: 201, headers: { Location: "/projects/p" } }),
    );
    const response = await proxyToApi(
      browserRequest("POST", "/api/projects?x=1", {
        headers: {
          ...safe,
          "accept-language": "en",
          "x-forwarded-for": "203.0.113.7, 10.0.0.2",
          "x-request-id": "del-navegador",
        },
        body: JSON.stringify({ name: "x" }),
      }),
      "/projects",
      deps({ apiFetch }),
    );

    expect(apiFetch.mock.calls[0][0]).toBe("http://api.internal:8000/projects?x=1");
    const headers = sentHeaders(apiFetch);
    expect(headers.get("authorization")).toBe(`Bearer ${session().accessToken}`);
    expect(headers.get("x-hindama-client-ip")).toBe("10.0.0.2");
    expect(headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.get("accept-language")).toBe("en");
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("x-csrf-token")).toBeNull();
    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe("/api/projects/p");
  });

  it("renueva antes de reenviar si al access token le quedan menos de 5 minutos", async () => {
    const fresh = jwt({ exp: nowSeconds + 15 * 60, username: "uuid-interno" });
    const cognitoFetch = vi.fn<FetchLike>(async () => cognitoTokens(fresh));
    const apiFetch = apiReturning(Response.json({}));
    const expiring = session({ accessToken: jwt({ exp: nowSeconds + 4 * 60 }) });

    const response = await proxyToApi(
      browserRequest("GET", "/api/me", { cookie: sessionCookie(expiring) }),
      "/me",
      deps({ apiFetch, cognitoFetch }),
    );

    const body = JSON.parse(String(cognitoFetch.mock.calls[0][1].body));
    expect(body.AuthFlow).toBe("REFRESH_TOKEN_AUTH");
    // SECRET_HASH con el username interno, no con el correo (sección 2.4).
    expect(body.AuthParameters.SECRET_HASH).toBe(
      secretHash("uuid-interno", CONFIG.cognitoClientId, CONFIG.cognitoClientSecret),
    );
    expect(sentHeaders(apiFetch).get("authorization")).toBe(`Bearer ${fresh}`);

    const cookie = cookiesFrom(response).find((c) => c.startsWith("__Host-hindama_sesion="))!;
    const renewed = readSession(parseCookieHeader(cookie.split(";")[0]), KEY);
    expect(renewed).toMatchObject({ accessToken: fresh, refreshToken: "refresh-token" });
  });

  it("no renueva si quedan 5 minutos o más", async () => {
    const cognitoFetch = vi.fn<FetchLike>();
    await proxyToApi(browserRequest("GET", "/api/me"), "/me", deps({ cognitoFetch }));
    expect(cognitoFetch).not.toHaveBeenCalled();
  });

  it("tras un 401 renueva y reintenta una sola vez", async () => {
    const fresh = jwt({ exp: nowSeconds + 15 * 60 });
    const apiFetch = apiReturning(
      Response.json({ code: "auth.invalid_token" }, { status: 401 }),
      Response.json({ id: "me" }),
    );
    const cognitoFetch = vi.fn<FetchLike>(async () => cognitoTokens(fresh));

    const response = await proxyToApi(
      browserRequest("GET", "/api/me"),
      "/me",
      deps({ apiFetch, cognitoFetch }),
    );

    expect(response.status).toBe(200);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(cognitoFetch).toHaveBeenCalledTimes(1);
    expect(sentHeaders(apiFetch, 1).get("authorization")).toBe(`Bearer ${fresh}`);
  });

  it("si vuelve a dar 401, cierra la sesión", async () => {
    const apiFetch = apiReturning(
      Response.json({ code: "auth.invalid_token" }, { status: 401 }),
      Response.json({ code: "auth.invalid_token" }, { status: 401 }),
    );
    const cognitoFetch = vi.fn<FetchLike>(async () =>
      cognitoTokens(jwt({ exp: nowSeconds + 900 })),
    );

    const response = await proxyToApi(
      browserRequest("GET", "/api/me"),
      "/me",
      deps({ apiFetch, cognitoFetch }),
    );

    expect(response.status).toBe(401);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(
      cookiesFrom(response).some(
        (c) => c.startsWith("__Host-hindama_sesion=;") && c.includes("Max-Age=0"),
      ),
    ).toBe(true);
  });

  it("si Cognito rechaza el refresh token, cierra la sesión", async () => {
    const cognitoFetch = vi.fn<FetchLike>(
      async () =>
        new Response(JSON.stringify({ __type: "NotAuthorizedException" }), { status: 400 }),
    );
    const expiring = session({ accessToken: jwt({ exp: nowSeconds + 60 }) });
    const response = await proxyToApi(
      browserRequest("GET", "/api/me", { cookie: sessionCookie(expiring) }),
      "/me",
      deps({ cognitoFetch }),
    );
    expect(response.status).toBe(401);
    expect(cookiesFrom(response).some((c) => c.includes("Max-Age=0"))).toBe(true);
  });

  it("sin cookie, o con una cifrada con otra llave, responde 401 sin llamar a la API", async () => {
    const apiFetch = apiReturning();
    const none = await proxyToApi(
      browserRequest("GET", "/api/me", { cookie: null }),
      "/me",
      deps({ apiFetch }),
    );
    const rotated = await proxyToApi(
      browserRequest("GET", "/api/me", { cookie: sessionCookie(session(), Buffer.alloc(32, 7)) }),
      "/me",
      deps({ apiFetch }),
    );
    expect(none.status).toBe(401);
    expect(rotated.status).toBe(401);
    expect(cookiesFrom(rotated).some((c) => c.includes("Max-Age=0"))).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("errores hacia el navegador", () => {
  it("deja solo los campos de Problem Details y nunca detalles internos", async () => {
    const apiFetch = apiReturning(
      new Response(
        JSON.stringify({
          type: "urn:hindama:error:internal",
          title: "Error",
          status: 500,
          detail: "",
          code: "internal",
          request_id: "r-500",
          errors: [],
          traceback: "File app.py line 3",
        }),
        { status: 500, headers: { "Content-Type": "application/problem+json" } },
      ),
    );
    const response = await proxyToApi(browserRequest("GET", "/api/me"), "/me", deps({ apiFetch }));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toMatchObject({ code: "internal", request_id: "r-500" });
    expect(body).not.toHaveProperty("traceback");
  });

  it("reemplaza un cuerpo que no es Problem Details por un error genérico", async () => {
    const apiFetch = apiReturning(
      new Response("<html>Bad gateway at 10.0.0.5</html>", { status: 502 }),
    );
    const response = await proxyToApi(browserRequest("GET", "/api/me"), "/me", deps({ apiFetch }));
    const text = await response.text();
    expect(text).not.toContain("10.0.0.5");
    expect(JSON.parse(text)).toMatchObject({ code: "internal", status: 502 });
  });

  it("pasa el 429 con Retry-After y el 403 tal cual (Next.js no decide permisos)", async () => {
    const apiFetch = apiReturning(
      Response.json(
        { code: "rate_limit.exceeded", request_id: "r", errors: [] },
        { status: 429, headers: { "Retry-After": "17" } },
      ),
      Response.json({ code: "role.forbidden", request_id: "r", errors: [] }, { status: 403 }),
    );
    const limited = await proxyToApi(browserRequest("GET", "/api/me"), "/me", deps({ apiFetch }));
    const forbidden = await proxyToApi(
      browserRequest("GET", "/api/projects"),
      "/projects",
      deps({ apiFetch }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("17");
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ code: "role.forbidden" });
  });

  it("si la API no responde, devuelve 503 service.unavailable", async () => {
    const apiFetch = vi.fn<FetchLike>(async () => {
      throw new TypeError("fetch failed: connect ECONNREFUSED 10.0.0.5:8000");
    });
    const response = await proxyToApi(browserRequest("GET", "/api/me"), "/me", deps({ apiFetch }));
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).not.toContain("ECONNREFUSED");
  });
});

describe("SSE del progreso (ADR-006)", () => {
  it("retransmite sin búfer, pasa Last-Event-ID y aborta la API al cerrar el navegador", async () => {
    const encoder = new TextEncoder();
    let upstreamSignal: AbortSignal | undefined;
    const apiFetch = vi.fn<FetchLike>(async (_url, init) => {
      upstreamSignal = init.signal ?? undefined;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('id: 1\nevent: snapshot\ndata: {"id":"r"}\n\n'));
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
    });
    const browser = new AbortController();
    const request = new Request(`${ORIGIN}/api/projects/p/runs/r/progress`, {
      headers: { cookie: sessionCookie(session()), "last-event-id": "7" },
      signal: browser.signal,
    });

    const response = await proxyToApi(
      request,
      apiPath("projects", "p", "runs", "r", "events"),
      deps({ apiFetch }),
      {
        stream: true,
      },
    );

    expect(apiFetch.mock.calls[0][0]).toBe("http://api.internal:8000/projects/p/runs/r/events");
    const headers = sentHeaders(apiFetch);
    expect(headers.get("accept")).toBe("text/event-stream");
    expect(headers.get("last-event-id")).toBe("7");
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("event: snapshot");

    browser.abort();
    expect(upstreamSignal?.aborted).toBe(true);
    await reader.cancel();
  });

  it("un 404 antes del stream llega como Problem Details", async () => {
    const apiFetch = apiReturning(
      Response.json({ code: "resource.not_found", request_id: "r", errors: [] }, { status: 404 }),
    );
    const response = await proxyToApi(
      browserRequest("GET", "/api/projects/p/runs/x/progress"),
      "/projects/p/runs/x/events",
      deps({ apiFetch }),
      { stream: true },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });
});

describe("rutas", () => {
  it("escapa los segmentos para que un parámetro no salga de la ruta", () => {
    expect(apiPath("projects", "../admin", "runs", "r")).toBe("/projects/..%2Fadmin/runs/r");
  });

  it("traduce Location de la API a la ruta del BFF", () => {
    expect(toBffLocation("/projects/p/runs/r", CONFIG.apiUrl)).toBe("/api/projects/p/runs/r");
    expect(toBffLocation("http://api.internal:8000/projects/p", CONFIG.apiUrl)).toBe(
      "/api/projects/p",
    );
    expect(toBffLocation("https://otro.test/x", CONFIG.apiUrl)).toBe("/api");
  });
});
