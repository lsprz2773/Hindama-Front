import { expect, test } from "./fixtures";
import { meBody, mockBff } from "./support/bff";

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

test.describe("V-34 bitácora de auditoría", () => {
  test("lista los registros paginados, de solo lectura", async ({ page }) => {
    await page.goto("/admin/audit-log");
    await expect(
      page.getByRole("heading", { name: "Bitácora de auditoría", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "34 registros" })).toBeVisible();
    await expect(page.getByText("Solo lectura · se conservan 6 meses")).toBeVisible();
    await expect(page.getByText("1–10 de 34")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();

    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("11–20 de 34")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("31–34 de 34")).toBeVisible();
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();

    // No hay acciones de editar ni de eliminar registros (RF-83).
    await expect(page.getByRole("button", { name: /editar|eliminar registro/i })).toHaveCount(0);
  });

  test("filtra por tipo de acción", async ({ page }) => {
    await page.goto("/admin/audit-log");
    await page.getByLabel("Tipo de acción").selectOption("accountDeleted");
    await expect(page.getByRole("heading", { name: "3 registros" })).toBeVisible();
    await expect(page.getByText("Cuenta eliminada").first()).toBeVisible();
  });

  test("filtra por correo, por identificador abreviado y avisa si no hay coincidencias", async ({
    page,
  }) => {
    await page.goto("/admin/audit-log");
    await page.getByLabel("Usuario").fill("luis@ejemplo.mx");
    await expect(page.getByRole("heading", { name: "15 registros" })).toBeVisible();

    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page.getByRole("heading", { name: "34 registros" })).toBeVisible();
    await page.getByTitle("Filtrar por este usuario").first().click();
    await expect(page.getByLabel("Usuario")).toHaveValue("usr_3f9a7c0d51b84e2ac21e");

    await page.getByLabel("Usuario").fill("nadie@ejemplo.mx");
    await expect(page.getByText(/Una cuenta eliminada ya no tiene correo/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sin registros" })).toBeVisible();
  });

  test("el host reportado se compara por su huella y nunca se muestra", async ({ page }) => {
    await page.goto("/admin/audit-log");
    await expect(
      page.getByText("Se compara por su huella; el host nunca se muestra."),
    ).toBeVisible();
    await page.getByLabel("Host reportado").fill("api.interno.ejemplo.mx");
    await expect(page.getByRole("heading", { name: "4 registros" })).toBeVisible();
    await expect(page.getByText("4 coincidencias por huella.")).toBeVisible();
    await page
      .getByRole("button", { name: /Detalle del registro/ })
      .first()
      .click();
    await expect(page.getByText(/Huella [0-9a-f]{4}…[0-9a-f]{4} \(HMAC\)/)).toBeVisible();
    await expect(page.getByText("api.interno.ejemplo.mx", { exact: true })).toHaveCount(0);

    await page.getByLabel("Host reportado").fill("otro.ejemplo.mx");
    await expect(page.getByText("Sin coincidencias para esa huella.")).toBeVisible();
  });

  test("un rango de fechas invertido se avisa y no consulta", async ({ page }) => {
    await page.goto("/admin/audit-log");
    // Si la hidratación tardía reinicia el formulario, se repiten ambos campos.
    await expect(async () => {
      await page.getByLabel("Desde").fill("2026-10-30");
      await page.getByLabel("Hasta").fill("2026-10-23");
      await expect(page.locator("#log-range-error")).toContainText("El rango está invertido", {
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText("Corrige el rango de fechas")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar" }).click();
    await expect(page.getByRole("heading", { name: "34 registros" })).toBeVisible();
  });

  test("expandir un registro muestra su detalle sin credenciales", async ({ page }) => {
    await page.goto("/admin/audit-log");
    const toggle = page.getByRole("button", { name: /Detalle del registro/ }).first();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("API2, API8, API1, API3")).toBeVisible();
    await expect(page.getByText("Límites", { exact: true })).toBeVisible();
    await toggle.click();
    await expect(page.getByText("API2, API8, API1, API3")).toHaveCount(0);

    await page.getByLabel("Tipo de acción").selectOption("identityCreated");
    await page
      .getByRole("button", { name: /Detalle del registro/ })
      .first()
      .click();
    await expect(page.getByText("No se registra")).toBeVisible();
  });

  test("copiar el identificador deja el completo en el portapapeles", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/admin/audit-log");
    await page
      .getByRole("button", { name: /Copiar el identificador completo/ })
      .first()
      .click();
    await expect(page.getByText("Identificador copiado")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "usr_3f9a7c0d51b84e2ac21e",
    );
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

  test("bitácora: carga con esqueleto, falla con reintento y se recupera", async ({ page }) => {
    await page.goto("/admin/audit-log");
    await expect(page.getByRole("heading", { name: "34 registros" })).toBeVisible();
    await page.evaluate(() => sessionStorage.setItem("hindama.simulate.error", "1"));
    await page.getByLabel("Tipo de acción").selectOption("accountDeleted");
    await expect(page.getByText("No pudimos cargar la bitácora")).toBeVisible();
    await page.evaluate(() => sessionStorage.removeItem("hindama.simulate.error"));
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { name: "3 registros" })).toBeVisible();
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
