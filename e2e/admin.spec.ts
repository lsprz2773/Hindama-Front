import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { meBody, mockBff, problem } from "./support/bff";

// Las pantallas de administración se muestran según el rol que informa `getMe`.
test.use({ role: "admin" });

test.describe("V-33 estadísticas de uso", () => {
  test("muestra los indicadores agregados y las gráficas del periodo por omisión", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Estadísticas de uso", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "Últimos 30 días" })).toBeChecked();
    const kpis = page.locator("dl").first();
    await expect(kpis).toContainText("Usuarios activos");
    await expect(kpis).toContainText("128");
    await expect(kpis).toContainText("1,032");
    await expect(kpis).toContainText("Cuentas eliminadas");
    await expect(kpis).toContainText("Regresiones");

    await expect(page.getByRole("heading", { name: "Ejecuciones por semana" })).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Ejecuciones por semana: 6 oct, 229/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Fallas por módulo" }).getByRole("listitem"),
    ).toHaveCount(7);
    await expect(
      page.getByRole("list", { name: "Fallas por categoría OWASP" }).getByRole("listitem"),
    ).toHaveCount(6);
    await expect(page.getByText(/Solo datos agregados y anónimos/)).toBeVisible();
  });

  test("la barra lateral es la del administrador y no ofrece proyectos", async ({ page }) => {
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Estadísticas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Bitácora" })).toBeVisible();
    await expect(nav.getByText("API de Pedidos")).toHaveCount(0);
  });

  test("cambiar de periodo actualiza los indicadores y la agrupación", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("radio", { name: "Últimos 7 días" }).click();
    await expect(page.getByRole("heading", { name: "Ejecuciones por día" })).toBeVisible();
    await expect(page.locator("dl").first()).toContainText("74");
    await page.getByRole("radio", { name: "Últimos 90 días" }).click();
    await expect(page.locator("dl").first()).toContainText("2,946");
    await expect(page.getByRole("img", { name: /8 sep, 182/ })).toBeVisible();
  });

  test("el periodo personalizado valida las fechas y avisa cuando no hay datos", async ({
    page,
  }) => {
    await page.goto("/admin");
    await page.getByRole("radio", { name: "Personalizado" }).click();
    await page.getByLabel("Desde").fill("2026-10-20");
    await page.getByLabel("Hasta").fill("2026-10-10");
    await expect(page.locator("#stats-range-error")).toContainText("Escribe un rango válido");
    await expect(page.getByRole("heading", { name: "Ejecuciones por semana" })).toHaveCount(0);

    await page.getByLabel("Desde").fill("2026-08-01");
    await page.getByLabel("Hasta").fill("2026-08-15");
    await expect(page.getByText("Sin datos en este periodo")).toBeVisible();

    await page.getByLabel("Desde").fill("2026-10-01");
    await page.getByLabel("Hasta").fill("2026-10-30");
    await expect(page.getByRole("heading", { name: "Ejecuciones por semana" })).toBeVisible();
  });

  test("lleva a la bitácora", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Ver bitácora" }).click();
    await expect(page).toHaveURL(/\/admin\/audit-log$/);
  });
});

const AUDIT_URL = "**/api/admin/audit-log**";
const USER_ID = "0192e3a0-1111-7000-8000-000000000001";
const OTHER_USER_ID = "0192e3a0-1111-7000-8000-000000000002";
const PROJECT = "0192e3a0-2222-7000-8000-000000000001";
const RUN = "0192e3a0-7777-7000-8000-000000000003";

/** Ejemplo `AuditLogPage` del contrato 0.7.0: una ejecución lanzada y un bloqueo del motor. */
const LAUNCHED = {
  id: 1041,
  occurred_at: "2026-11-17T09:10:00Z",
  action: "run_launched",
  user_id: USER_ID,
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
const BLOCKED = {
  id: 1042,
  occurred_at: "2026-11-17T09:12:03Z",
  action: "destination_blocked",
  user_id: USER_ID,
  project_id: PROJECT,
  source_ip: null,
  details: { stage: "run", block_reason: "address_not_allowed", run_id: RUN },
};
const CREATED = {
  id: 1040,
  occurred_at: "2026-11-17T09:00:00Z",
  action: "account_created",
  user_id: OTHER_USER_ID,
  project_id: null,
  source_ip: "2001:db8::1",
  details: {},
};
const logPage = (items: unknown[], extra: { total?: number; page?: number } = {}) => ({
  items,
  total: extra.total ?? items.length,
  page: extra.page ?? 1,
  page_size: 20,
});

/** Responde `listAuditLog` y guarda las consultas que llegaron al BFF. */
async function mockAuditLog(page: Page, handler: (url: URL) => { status?: number; body: unknown }) {
  const requests: URL[] = [];
  await page.route(AUDIT_URL, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const { status = 200, body } = handler(url);
    await route.fulfill({
      status,
      contentType: status >= 400 ? "application/problem+json" : "application/json",
      body: JSON.stringify(body),
    });
  });
  return requests;
}
const lastQuery = (requests: URL[]) => requests[requests.length - 1].searchParams;

test.describe("V-34 bitácora de auditoría", () => {
  test("lista los registros con listAuditLog, de solo lectura", async ({ page }) => {
    const requests = await mockAuditLog(page, () => ({
      body: logPage([BLOCKED, LAUNCHED, CREATED]),
    }));
    await page.goto("/admin/audit-log");
    await expect(
      page.getByRole("heading", { name: "Bitácora de auditoría", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "3 registros" })).toBeVisible();
    await expect(page.getByText("Solo lectura · se conservan 6 meses")).toBeVisible();
    const rows = page.getByRole("listitem");
    await expect(rows.filter({ hasText: "Destino bloqueado" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Ejecución lanzada" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Alta de cuenta" })).toHaveCount(1);
    // Las acciones del motor no traen IP; las del navegador, la suya (IPv4 o IPv6).
    await expect(page.getByText("203.0.113.25")).toBeVisible();
    await expect(page.getByText("2001:db8::1")).toBeVisible();
    await expect(page.getByText("1–3 de 3")).toBeVisible();
    expect(lastQuery(requests).get("page")).toBe("1");
    expect(lastQuery(requests).get("page_size")).toBe("20");

    // No hay acciones de editar ni de eliminar registros (RF-83).
    await expect(page.getByRole("button", { name: /editar|eliminar registro/i })).toHaveCount(0);
  });

  test("pagina con la API", async ({ page }) => {
    const requests = await mockAuditLog(page, (url) => {
      const current = Number(url.searchParams.get("page") ?? "1");
      return {
        body: logPage(current === 1 ? [BLOCKED, LAUNCHED] : [CREATED], {
          total: 21,
          page: current,
        }),
      };
    });
    await page.goto("/admin/audit-log");
    await expect(page.getByText("1–2 de 21")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("21–21 de 21")).toBeVisible();
    expect(lastQuery(requests).get("page")).toBe("2");
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  test("filtra por tipo de acción con el valor del contrato", async ({ page }) => {
    const requests = await mockAuditLog(page, (url) => ({
      body: logPage(url.searchParams.has("action") ? [BLOCKED] : [BLOCKED, LAUNCHED, CREATED]),
    }));
    await page.goto("/admin/audit-log");
    await expect(page.getByRole("heading", { name: "3 registros" })).toBeVisible();
    await page.getByLabel("Tipo de acción").selectOption("destination_blocked");
    await expect(page.getByRole("heading", { name: "1 registro" })).toBeVisible();
    expect(lastQuery(requests).getAll("action")).toEqual(["destination_blocked"]);
    // Las 13 acciones del contrato están en el selector, también las nuevas.
    const options = await page.getByLabel("Tipo de acción").locator("option").allTextContents();
    expect(options).toHaveLength(14);
    expect(options).toContain("Verificación perdida al iniciar una ejecución");
    expect(options).toContain("Descarte revertido");
  });

  test("el usuario se filtra por su identificador completo, no por correo", async ({ page }) => {
    const requests = await mockAuditLog(page, (url) => ({
      body: logPage(url.searchParams.get("user_id") === USER_ID ? [BLOCKED, LAUNCHED] : [CREATED]),
    }));
    await page.goto("/admin/audit-log");
    await expect(page.getByText("1–1 de 1")).toBeVisible();
    const before = requests.length;

    // Un correo o un fragmento no se consultan: la API solo compara el identificador completo.
    await page.getByLabel("Usuario").fill("luis@ejemplo.mx");
    await expect(page.getByText("Escribe el identificador completo (UUID)")).toBeVisible();
    await expect(page.getByText("Corrige los filtros")).toBeVisible();
    expect(requests).toHaveLength(before);

    await page.getByLabel("Usuario").fill(USER_ID);
    await expect(page.getByRole("heading", { name: "2 registros" })).toBeVisible();
    expect(lastQuery(requests).get("user_id")).toBe(USER_ID);

    // Un clic en el identificador de la tabla lo usa como filtro.
    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page.getByRole("heading", { name: "1 registro" })).toBeVisible();
    await page.getByTitle("Filtrar por este usuario").first().click();
    await expect(page.getByLabel("Usuario")).toHaveValue(OTHER_USER_ID);
    expect(lastQuery(requests).get("user_id")).toBe(OTHER_USER_ID);
  });

  test("el host se envía por nombre y la API lo compara por su HMAC", async ({ page }) => {
    const requests = await mockAuditLog(page, (url) => {
      const host = url.searchParams.get("host");
      if (host === "???") return { status: 422, body: problem(422, "validation.failed") };
      return { body: logPage(host ? [BLOCKED] : [BLOCKED, LAUNCHED]) };
    });
    await page.goto("/admin/audit-log");
    await expect(
      page.getByText(/Se compara por su HMAC: el host nunca se guarda ni se muestra/),
    ).toBeVisible();
    await page.getByLabel("Host reportado").fill("api.ejemplo.mx");
    await expect(page.getByRole("heading", { name: "1 registro" })).toBeVisible();
    expect(lastQuery(requests).get("host")).toBe("api.ejemplo.mx");

    await page.getByLabel("Host reportado").fill("???");
    await expect(page.getByText("Eso no es un host válido.")).toBeVisible();
    await expect(page.getByText("Corrige los filtros")).toBeVisible();
  });

  test("las fechas se envían con zona como inicio y fin exclusivo", async ({ page }) => {
    const requests = await mockAuditLog(page, () => ({ body: logPage([LAUNCHED]) }));
    await page.goto("/admin/audit-log");
    await expect(page.getByRole("heading", { name: "1 registro" })).toBeVisible();
    await page.getByLabel("Desde").fill("2026-11-17");
    await page.getByLabel("Hasta").fill("2026-11-17");
    const [from, to] = await page.evaluate(() => [
      new Date(2026, 10, 17).toISOString(),
      new Date(2026, 10, 18).toISOString(),
    ]);
    await expect.poll(() => lastQuery(requests).get("occurred_to")).toBe(to);
    expect(lastQuery(requests).get("occurred_from")).toBe(from);
  });

  test("un rango de fechas invertido se avisa y no consulta", async ({ page }) => {
    const requests = await mockAuditLog(page, () => ({ body: logPage([LAUNCHED]) }));
    await page.goto("/admin/audit-log");
    await expect(page.getByRole("heading", { name: "1 registro" })).toBeVisible();
    // Si la hidratación tardía reinicia el formulario, se repiten ambos campos.
    await expect(async () => {
      await page.getByLabel("Desde").fill("2026-10-30");
      await page.getByLabel("Hasta").fill("2026-10-23");
      await expect(page.locator("#log-range-error")).toContainText("El rango está invertido", {
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText("Corrige el rango de fechas")).toBeVisible();
    // Ninguna consulta lleva un rango invertido.
    for (const url of requests) {
      const from = url.searchParams.get("occurred_from");
      const to = url.searchParams.get("occurred_to");
      if (from && to) expect(new Date(from) <= new Date(to)).toBe(true);
    }
    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page.getByRole("heading", { name: "1 registro" })).toBeVisible();
  });

  test("expandir un registro muestra solo los datos de su acción, sin credenciales", async ({
    page,
  }) => {
    await mockAuditLog(page, () => ({ body: logPage([BLOCKED, LAUNCHED, CREATED]) }));
    await page.goto("/admin/audit-log");
    const toggles = page.getByRole("button", { name: /Detalle del registro/ });
    await expect(toggles).toHaveCount(3);

    // Bloqueo del motor: etapa, motivo y ejecución.
    await toggles.nth(0).click();
    await expect(toggles.nth(0)).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Etapa del bloqueo")).toBeVisible();
    await expect(
      page.getByText("Dirección no permitida (privada, local o de metadatos)"),
    ).toBeVisible();
    await toggles.nth(0).click();

    // Ejecución lanzada: módulos y límites.
    await toggles.nth(1).click();
    await expect(page.getByText("Acceso a objetos, Configuración")).toBeVisible();
    await expect(
      page.getByText("5 req/s · 2 concurrentes · 5000 peticiones · 30 min"),
    ).toBeVisible();
    await toggles.nth(1).click();
    await expect(page.getByText("Acceso a objetos, Configuración")).toHaveCount(0);

    // Alta de cuenta: sin datos adicionales.
    await toggles.nth(2).click();
    await expect(page.getByText("Esta acción no trae datos adicionales.")).toBeVisible();
  });

  test("copiar el identificador deja el completo en el portapapeles", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockAuditLog(page, () => ({ body: logPage([LAUNCHED]) }));
    await page.goto("/admin/audit-log");
    await page
      .getByRole("button", { name: /Copiar el identificador completo/ })
      .first()
      .click();
    await expect(page.getByText("Identificador copiado")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(USER_ID);
  });

  test("sin registros explica cómo ampliar la búsqueda", async ({ page }) => {
    await mockAuditLog(page, () => ({ body: logPage([]) }));
    await page.goto("/admin/audit-log");
    await expect(page.getByText("No hay registros con estos filtros")).toBeVisible();
  });
});

test.describe("estados de carga, error y permiso de la bitácora", () => {
  test("bitácora: si la consulta falla ofrece reintentar y se recupera", async ({ page }) => {
    let failing = true;
    await mockAuditLog(page, () =>
      failing
        ? { status: 503, body: problem(503, "service.unavailable") }
        : { body: logPage([LAUNCHED]) },
    );
    await page.goto("/admin/audit-log");
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    failing = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { name: "1 registro" })).toBeVisible();
  });

  test("bitácora: un 403 de la API (rol sin permiso) se muestra como página de error", async ({
    page,
  }) => {
    await mockAuditLog(page, () => ({ status: 403, body: problem(403, "role.forbidden") }));
    await page.goto("/admin/audit-log");
    await expect(page.getByText("Esta sección no es para tu rol")).toBeVisible();
  });
});

test.describe("estados de carga, error y permiso del panel", () => {
  test("estadísticas: muestra el esqueleto y luego los datos", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("radio", { name: "Últimos 7 días" }).click();
    await expect(page.getByLabel("Cargando estadísticas")).toBeVisible();
    await expect(page.getByLabel("Cargando estadísticas")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Ejecuciones por día" })).toBeVisible();
  });

  test("estadísticas: si la consulta falla ofrece reintentar", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("hindama.simulate.error", "1"));
    await page.goto("/admin");
    await expect(page.getByText("No pudimos cargar las estadísticas")).toBeVisible();
    await expect(page.getByText(/Referencia/)).toBeVisible();
    await page.evaluate(() => sessionStorage.removeItem("hindama.simulate.error"));
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { name: "Ejecuciones por semana" })).toBeVisible();
  });

  test("un analista con sesión no entra al panel de administración", async ({ page }) => {
    await mockBff(page, "**/api/me", { body: meBody("analyst") }, "GET");
    for (const path of ["/admin", "/admin/audit-log"]) {
      await page.goto(path);
      await expect(page.getByText("Esta sección no es para tu rol")).toBeVisible();
      await expect(page.getByRole("link", { name: "Ir a mis proyectos" })).toBeVisible();
    }
  });

  test("iniciar sesión como analista y luego abrir /admin da 403", async ({ page }) => {
    await mockBff(page, "**/api/auth/sign-in", { body: { csrf_token: "t", role: "analyst" } });
    await mockBff(page, "**/api/me", { body: meBody("analyst") }, "GET");
    await page.goto("/sign-in");
    await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
    await page.getByLabel("Contraseña", { exact: true }).fill("Clave-Segura-2026");
    await page.getByRole("button", { name: "Iniciar sesión" }).first().click();
    await expect(page).toHaveURL(/\/(projects|sign-in\/two-factor)$/);
    if (page.url().endsWith("two-factor")) return;
    await page.goto("/admin");
    await expect(page.getByText("Esta sección no es para tu rol")).toBeVisible();
  });
});
