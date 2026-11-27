import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { meBody, mockBff, problem } from "./support/bff";

// Las pantallas de administración se muestran según el rol que informa `getMe`.
test.use({ role: "admin" });

const STATS_URL = "**/api/admin/stats**";

/** Ejemplo `AdminStats` del contrato 0.9.0, con los números que las pruebas buscan en pantalla. */
const STATS = {
  period: { date_from: "2026-11-16", date_to: "2026-11-22", group: "day" },
  users: { total: 18, new: 3, deleted: 2 },
  projects: { created: 4 },
  runs: { started: 1032, cancelled: 41, failed: 6 },
  activity: [
    ["2026-11-16", 3],
    ["2026-11-17", 0],
    ["2026-11-18", 4],
  ].map(([start, started]) => ({
    start,
    new_users: 1,
    deleted_accounts: 0,
    projects_created: 1,
    runs_started: started,
    runs_cancelled: 0,
    runs_failed: 0,
  })),
  findings: {
    detected: 9,
    resolved: 3,
    regressions: 37,
    average_days_to_resolve: 2.67,
    by_severity: { critical: 1, high: 3, medium: 2, low: 2, info: 1, total: 9 },
    by_module: [
      { module: "object_access", detected: 4 },
      { module: "configuration", detected: 3 },
      { module: "authentication", detected: 2 },
    ],
    by_owasp_category: [
      { owasp_category: "API1:2023", detected: 4 },
      { owasp_category: "API8:2023", detected: 3 },
      { owasp_category: "API2:2023", detected: 2 },
      { owasp_category: "API9:2023", detected: 1 },
    ],
    weekly: [
      { week: "2026-11-09", detected: 2 },
      { week: "2026-11-16", detected: 7 },
    ],
  },
};

/** Día de hoy en UTC, como lo calcula la vista, y el de hace `back` días. */
const utcDay = (back = 0) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);

/** Responde `getAdminStats` y guarda las consultas que llegaron al BFF. */
async function mockStats(page: Page, handler: (url: URL) => { status?: number; body: unknown }) {
  const requests: URL[] = [];
  await page.route(STATS_URL, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const { status = 200, body } = handler(url);
    await route.fulfill({
      status,
      headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json" },
      body: JSON.stringify(body),
    });
  });
  return requests;
}

test.describe("V-33 estadísticas de uso", () => {
  test("pide los últimos 30 días y muestra los indicadores y las gráficas", async ({ page }) => {
    const requests = await mockStats(page, () => ({ body: STATS }));
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Estadísticas de uso", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "Últimos 30 días" })).toBeChecked();
    const kpis = page.locator("dl").first();
    await expect(kpis).toContainText("Usuarios registrados");
    await expect(kpis).toContainText("18");
    await expect(kpis).toContainText("3 cuentas nuevas");
    await expect(kpis).toContainText("1032");
    await expect(kpis).toContainText("41 canceladas · 6 fallidas");
    await expect(kpis).toContainText("2,7 días");
    await expect(kpis).toContainText("Cuentas eliminadas");
    await expect(kpis).toContainText("37");
    // Sin `date_to` ni `group=week`: la API termina hoy y 30 días van por día.
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("date_from")).toBe(utcDay(29));
    expect(requests[0].searchParams.get("date_to")).toBe(utcDay());
    expect(requests[0].searchParams.get("group")).toBe("day");

    await expect(page.getByRole("heading", { name: "Ejecuciones por día" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Ejecuciones por día: 16 nov, 3/ })).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Hallazgos detectados por semana: 9 nov, 2; 16 nov, 7/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Fallas por módulo" }).getByRole("listitem"),
    ).toHaveCount(3);
    const owasp = page.getByRole("list", { name: "Fallas por categoría OWASP" });
    await expect(owasp.getByRole("listitem")).toHaveCount(4);
    await expect(owasp).toContainText("API1 Objetos");
    // Una categoría que el frontend no conoce se muestra tal cual.
    await expect(owasp).toContainText("API9:2023");
    await expect(page.getByText(/Solo datos agregados y anónimos/)).toBeVisible();
  });

  test("sin hallazgos resueltos el promedio es un guion", async ({ page }) => {
    await mockStats(page, () => ({
      body: {
        ...STATS,
        findings: {
          ...STATS.findings,
          average_days_to_resolve: null,
          by_module: [],
          by_owasp_category: [],
        },
      },
    }));
    await page.goto("/admin");
    const kpis = page.locator("dl").first();
    await expect(
      kpis.locator("dt", { hasText: "De la detección a la resolución" }).locator(".."),
    ).toContainText("—");
    await expect(kpis).not.toContainText("días");
    await expect(page.getByText("Sin hallazgos en este periodo")).toHaveCount(2);
  });

  test("la barra lateral es la del administrador y no ofrece proyectos", async ({ page }) => {
    await mockStats(page, () => ({ body: STATS }));
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Estadísticas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Bitácora" })).toBeVisible();
    await expect(nav.getByText("API de Pedidos")).toHaveCount(0);
  });

  test("cambiar de periodo vuelve a consultar con sus fechas y su agrupación", async ({ page }) => {
    const requests = await mockStats(page, (url) => ({
      body: {
        ...STATS,
        period: {
          date_from: url.searchParams.get("date_from"),
          date_to: url.searchParams.get("date_to"),
          group: url.searchParams.get("group"),
        },
      },
    }));
    await page.goto("/admin");
    await expect(page.locator("dl").first()).toBeVisible();

    await page.getByRole("radio", { name: "Últimos 7 días" }).click();
    await expect(page.getByRole("radio", { name: "Últimos 7 días" })).toBeChecked();
    await expect.poll(() => requests.at(-1)?.searchParams.get("date_from")).toBe(utcDay(6));
    expect(requests.at(-1)?.searchParams.get("group")).toBe("day");
    await expect(page.getByRole("heading", { name: "Ejecuciones por día" })).toBeVisible();

    await page.getByRole("radio", { name: "Últimos 90 días" }).click();
    await expect.poll(() => requests.at(-1)?.searchParams.get("date_from")).toBe(utcDay(89));
    expect(requests.at(-1)?.searchParams.get("group")).toBe("week");
    await expect(page.getByRole("heading", { name: "Ejecuciones por semana" })).toBeVisible();
  });

  test("el periodo personalizado valida las fechas y consulta el rango elegido", async ({
    page,
  }) => {
    const requests = await mockStats(page, () => ({ body: STATS }));
    await page.goto("/admin");
    await expect(page.locator("dl").first()).toBeVisible();
    await page.getByRole("radio", { name: "Personalizado" }).click();
    await page.getByLabel("Desde").fill("2026-10-20");
    await page.getByLabel("Hasta").fill("2026-10-10");
    await expect(page.locator("#stats-range-error")).toContainText("Escribe un rango válido");
    await expect(page.getByRole("heading", { name: "Ejecuciones por día" })).toHaveCount(0);
    const before = requests.length;

    // Más de 366 días tampoco se consulta.
    await page.getByLabel("Desde").fill("2024-01-01");
    await page.getByLabel("Hasta").fill("2026-10-10");
    await expect(page.locator("#stats-range-error")).toBeVisible();
    expect(requests).toHaveLength(before);

    await page.getByLabel("Desde").fill("2026-10-01");
    await page.getByLabel("Hasta").fill("2026-10-10");
    await expect(page.locator("#stats-range-error")).toHaveCount(0);
    await expect.poll(() => requests.at(-1)?.searchParams.get("date_from")).toBe("2026-10-01");
    expect(requests.at(-1)?.searchParams.get("date_to")).toBe("2026-10-10");
    expect(requests.at(-1)?.searchParams.get("group")).toBe("day");
    await expect(page.getByRole("heading", { name: "Ejecuciones por día" })).toBeVisible();
  });

  test("avisa cuando el periodo no tiene actividad", async ({ page }) => {
    await mockStats(page, () => ({
      body: {
        ...STATS,
        users: { total: 18, new: 0, deleted: 0 },
        projects: { created: 0 },
        runs: { started: 0, cancelled: 0, failed: 0 },
        findings: {
          ...STATS.findings,
          detected: 0,
          resolved: 0,
          regressions: 0,
          average_days_to_resolve: null,
          by_module: [],
          by_owasp_category: [],
        },
      },
    }));
    await page.goto("/admin");
    await expect(page.getByText("Sin datos en este periodo")).toBeVisible();
    await expect(page.locator("dl")).toHaveCount(0);
  });

  test("lleva a la bitácora", async ({ page }) => {
    await mockStats(page, () => ({ body: STATS }));
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
    await mockStats(page, () => ({ body: STATS }));
    await page.goto("/admin");
    await page.getByRole("radio", { name: "Últimos 7 días" }).click();
    await expect(page.getByRole("heading", { name: "Ejecuciones por día" })).toBeVisible();
    await expect(page.getByLabel("Cargando estadísticas")).toHaveCount(0);
  });

  test("estadísticas: si la consulta falla ofrece reintentar", async ({ page }) => {
    let fail = true;
    await mockStats(page, () =>
      fail ? { status: 500, body: problem(500, "internal.error") } : { body: STATS },
    );
    await page.goto("/admin");
    await expect(page.getByText("Referencia: req-e2e-500")).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { name: "Ejecuciones por día" })).toBeVisible();
  });

  test("estadísticas: el 403 de la API para un analista se muestra con la página de error", async ({
    page,
  }) => {
    await mockStats(page, () => ({ status: 403, body: problem(403, "role.forbidden") }));
    await page.goto("/admin");
    await expect(page.getByText("Esta sección no es para tu rol")).toBeVisible();
  });

  test("estadísticas: la API manda un 429 con espera", async ({ page }) => {
    await mockStats(page, () => ({ status: 429, body: problem(429, "rate_limited") }));
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.locator("dl")).toHaveCount(0);
  });

  test("un analista con sesión no entra al panel de administración", async ({ page }) => {
    await mockBff(page, "**/api/me", { body: meBody("analyst") }, "GET");
    for (const path of ["/admin", "/admin/audit-log"]) {
      await page.goto(path);
      await expect(page.getByText("Esta sección no es para tu rol")).toBeVisible();
      await expect(
        page
          .getByRole("region", { name: "Esta sección no es para tu rol" })
          .getByRole("link", { name: "Ir a mis proyectos" }),
      ).toBeVisible();
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
