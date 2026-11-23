import type { Page, Request } from "@playwright/test";

/**
 * Respuestas simuladas del BFF para lo que el simulador del contrato no produce (errores
 * forzados, Cognito). Siempre con la forma Problem Details del contrato (`Problem`).
 */
export function problem(
  status: number,
  code: string,
  errors: { field: string | null; code: string }[] = [],
) {
  return {
    type: `urn:hindama:error:${code}`,
    title: code,
    status,
    detail: "",
    code,
    request_id: `req-e2e-${status}`,
    errors: errors.map((e) => ({ ...e, message: "" })),
  };
}

interface Fulfill {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Atiende `pattern` (p. ej. `**\/api/auth/sign-in`) en el navegador y guarda cada petición.
 * Con `method`, solo intercepta ese método y deja pasar los demás al BFF real.
 */
export async function mockBff(page: Page, pattern: string, response: Fulfill, method?: string) {
  const requests: Request[] = [];
  await page.route(pattern, async (route) => {
    if (method && route.request().method() !== method) return route.fallback();
    requests.push(route.request());
    const status = response.status ?? 200;
    const isProblem = status >= 400;
    await route.fulfill({
      status,
      headers: {
        "content-type": isProblem ? "application/problem+json" : "application/json",
        ...response.headers,
      },
      body: response.body === undefined ? "" : JSON.stringify(response.body),
    });
  });
  return requests;
}

/** Cuerpo de `getMe` (esquema `Me` del contrato) con el rol pedido. */
export function meBody(role: "analyst" | "admin") {
  return {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    name: "Ana López",
    email: "ana@ejemplo.mx",
    role,
    mfa_enabled: false,
    terms: {
      current_version: "2026-10-30",
      accepted_version: "2026-10-30",
      accepted_at: "2026-10-30T12:00:00Z",
      acceptance_required: false,
    },
  };
}
