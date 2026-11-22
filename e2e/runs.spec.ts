import { expect, test } from "./fixtures";
import { mockBff, problem } from "./support/bff";
import { finding } from "./support/findings";
import { project, PROJECT_ID } from "./support/projects";
import { completedRun, mockProgress, RUN_ID, runningRun, runningSummary } from "./support/runs";

const PROJECT = `**/api/projects/${PROJECT_ID}`;
const BASE = `/projects/${PROJECT_ID}`;

test.describe("V-25 configurar una ejecución", () => {
  test("parte de los módulos disponibles de bajo riesgo y explica los bloqueados", async ({
    page,
  }) => {
    await page.goto(`${BASE}/runs/new`);
    await expect(page.getByRole("heading", { name: "Nueva ejecución", level: 1 })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Autenticación/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Configuración/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Propiedades/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Inyección SQL/ })).not.toBeChecked();
    // `ModuleAvailability.missing` del proyecto: el primer requisito que falta y dónde resolverlo.
    await expect(page.getByRole("checkbox", { name: /Acceso a objetos/ })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: /Acceso a funciones/ })).toBeDisabled();
    await expect(page.getByText("Requiere al menos dos identidades")).toBeVisible();
    await expect(page.getByText("Requiere una identidad administradora")).toBeVisible();
    await expect(page.getByRole("link", { name: "Agregar identidad" }).first()).toHaveAttribute(
      "href",
      new RegExp(`${BASE}/identities/new$`),
    );
    await expect(page.getByRole("button", { name: "Ejecutar 2 módulos" })).toBeEnabled();
  });

  test("un módulo de riesgo exige confirmación antes de poder ejecutar", async ({ page }) => {
    await page.goto(`${BASE}/runs/new`);
    await page.getByRole("checkbox", { name: /^Propiedades/ }).check();
    await expect(
      page.getByRole("heading", { name: /Activaste módulos que modifican datos/ }),
    ).toBeVisible();
    const run = page.getByRole("button", { name: "Ejecutar 3 módulos" });
    await expect(run).toBeDisabled();
    await expect(
      page.getByText("Confirma cada módulo de riesgo para poder ejecutar."),
    ).toBeVisible();

    await page.getByRole("checkbox", { name: /Confirmar Propiedades/ }).check();
    await expect(run).toBeEnabled();

    // Desmarcar el módulo retira la advertencia y su confirmación.
    await page.getByRole("checkbox", { name: /^Propiedades/ }).uncheck();
    await expect(page.getByRole("heading", { name: /Activaste módulos/ })).toHaveCount(0);
  });

  test("un límite fuera de rango lo avisa y bloquea la ejecución", async ({ page }) => {
    await page.goto(`${BASE}/runs/new`);
    const rps = page.getByLabel("Peticiones por segundo");
    await expect(rps).toHaveValue("5");
    await expect(page.getByLabel("Peticiones en total")).toHaveValue("5000");
    await rps.fill("99");
    await expect(page.getByText("Escribe un número entero entre 1 y 20.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ejecutar 2 módulos" })).toBeDisabled();
    await rps.fill("8");
    await expect(page.getByRole("button", { name: "Ejecutar 2 módulos" })).toBeEnabled();
  });

  test("ejecutar envía los módulos, los límites y la confirmación, y abre la vista en curso", async ({
    page,
  }) => {
    await mockProgress(page, [{ event: "snapshot", data: runningRun() }]);
    const calls = await mockBff(
      page,
      `${PROJECT}/runs`,
      { status: 202, body: runningRun({ status: "queued" }) },
      "POST",
    );
    // El simulador siempre responde el `last_run` de su ejemplo; tras crear, el proyecto real
    // trae la nueva ejecución como la última.
    await page.route(PROJECT, (route) =>
      route.request().method() === "GET" && calls.length > 0
        ? route.fulfill({ json: project({ last_run: runningSummary({ status: "queued" }) }) })
        : route.fallback(),
    );
    await page.goto(`${BASE}/runs/new`);
    await page.getByRole("checkbox", { name: /^Inyección SQL/ }).check();
    await page.getByRole("checkbox", { name: /Confirmar Inyección SQL/ }).check();
    await page.getByLabel("Peticiones por segundo").fill("8");
    await page.getByRole("button", { name: "Ejecutar 3 módulos" }).click();

    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/current$`));
    expect(calls).toHaveLength(1);
    expect(calls[0].postDataJSON()).toEqual({
      modules: ["authentication", "configuration", "sql_injection"],
      limits: {
        requests_per_second: 8,
        concurrency: 2,
        max_requests: 5000,
        max_duration_minutes: 30,
      },
      confirm_risk: true,
    });
    await expect(page.getByText("Ejecución n.º 3 en cola")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ejecución en curso", level: 1 })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Avance de la ejecución" })).toBeVisible();
  });

  test("sin módulos de riesgo no envía la confirmación", async ({ page }) => {
    await mockProgress(page, [{ event: "snapshot", data: runningRun() }]);
    const calls = await mockBff(
      page,
      `${PROJECT}/runs`,
      { status: 202, body: runningRun({ status: "queued" }) },
      "POST",
    );
    await page.goto(`${BASE}/runs/new`);
    await page.getByRole("button", { name: "Ejecutar 2 módulos" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/current$`));
    expect(calls[0].postDataJSON()).not.toHaveProperty("confirm_risk");
  });

  test("un módulo que dejó de estar disponible se avisa sin salir de la vista", async ({
    page,
  }) => {
    await mockBff(
      page,
      `${PROJECT}/runs`,
      {
        status: 422,
        body: problem(422, "run.module_unavailable", [
          { field: "modules.0", code: "run.module_unavailable" },
        ]),
      },
      "POST",
    );
    await page.goto(`${BASE}/runs/new`);
    await page.getByRole("button", { name: "Ejecutar 2 módulos" }).click();
    await expect(
      page.getByText(
        "Un módulo ya no cumple sus requisitos. Revisa la lista y vuelve a intentarlo.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/new$`));
    await expect(page.getByRole("button", { name: "Ejecutar 2 módulos" })).toBeEnabled();
  });

  test("un error del servidor muestra la referencia", async ({ page }) => {
    await mockBff(
      page,
      `${PROJECT}/runs`,
      { status: 500, body: problem(500, "internal.error") },
      "POST",
    );
    await page.goto(`${BASE}/runs/new`);
    await page.getByRole("button", { name: "Ejecutar 2 módulos" }).click();
    await expect(page.getByText("No se pudo iniciar la ejecución")).toBeVisible();
    await expect(page.getByText("Referencia: req-e2e-500")).toBeVisible();
  });

  test("con una ejecución activa no se puede configurar otra", async ({ page }) => {
    await mockBff(page, PROJECT, { body: project({ last_run: runningSummary() }) }, "GET");
    await page.goto(`${BASE}/runs/new`);
    await expect(page.getByText("Ya hay una ejecución en curso.")).toBeVisible();
    await page.getByRole("link", { name: "Ver la ejecución" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/current$`));
  });

  test("un proyecto sin verificar explica por qué no se puede ejecutar", async ({ page }) => {
    await mockBff(
      page,
      PROJECT,
      { body: project({ verification_status: "pending", verified_at: null }) },
      "GET",
    );
    await page.goto(`${BASE}/runs/new`);
    await expect(
      page.getByText("Verifica la URL base del proyecto antes de ejecutar."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Ir a verificación" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/verification$`));
  });
});

test.describe("V-16 repetir la última ejecución", () => {
  test("sin módulos de riesgo la repite sin confirmación", async ({ page }) => {
    await mockProgress(page, [{ event: "snapshot", data: runningRun() }]);
    const calls = await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs/*/rerun`,
      { status: 202, body: runningRun({ status: "queued" }) },
      "POST",
    );
    await page.goto(BASE);
    await page.getByRole("button", { name: "Repetir última ejecución" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/current$`));
    expect(calls[0].url()).toContain("/runs/0192e3a0-4444-7000-8000-000000000001/rerun");
    expect(calls[0].postDataJSON()).toEqual({});
  });

  test("con módulos de riesgo pide confirmarlos otra vez", async ({ page }) => {
    await mockProgress(page, [{ event: "snapshot", data: runningRun() }]);
    await mockBff(
      page,
      PROJECT,
      {
        body: project({
          last_run: runningSummary({
            id: "0192e3a0-4444-7000-8000-000000000001",
            number: 1,
            status: "completed",
            end_reason: "normal",
            finished_at: "2026-11-17T09:14:37Z",
          }),
        }),
      },
      "GET",
    );
    const calls = await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs/*/rerun`,
      { status: 202, body: runningRun({ status: "queued" }) },
      "POST",
    );
    await page.goto(BASE);
    await page.getByRole("button", { name: "Repetir última ejecución" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Repetir la ejecución n.º 1")).toBeVisible();
    await expect(dialog.getByText("Inyección SQL")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar y repetir" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/current$`));
    expect(calls[0].postDataJSON()).toEqual({ confirm_risk: true });
  });

  test("con otra ejecución activa lo avisa", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs/*/rerun`,
      { status: 409, body: problem(409, "project.active_run") },
      "POST",
    );
    await page.goto(BASE);
    await page.getByRole("button", { name: "Repetir última ejecución" }).click();
    await expect(page.getByText("Ya hay una ejecución en cola o en curso.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${BASE}$`));
  });
});

test.describe("V-26 ejecución en curso", () => {
  const active = (page: Parameters<typeof mockBff>[0]) =>
    mockBff(page, PROJECT, { body: project({ last_run: runningSummary() }) }, "GET");

  test("muestra el avance en vivo con los eventos del stream", async ({ page }) => {
    await active(page);
    const urls = await mockProgress(page, [
      { event: "snapshot", data: runningRun() },
      {
        event: "progress",
        data: { ...runningRun().progress, percent: 64, requests_sent: 97, cells_evaluated: 77 },
      },
    ]);
    await page.goto(`${BASE}/runs/current`);
    await expect(page.getByRole("heading", { name: "Ejecución en curso", level: 1 })).toBeVisible();
    await expect(page.getByText("En vivo")).toBeVisible();
    const bar = page.getByRole("progressbar", { name: "Avance de la ejecución" });
    await expect(bar).toHaveAttribute("aria-valuenow", "64");
    await expect(page.getByText("77 / 120")).toBeVisible();
    await expect(page.getByText("2 hallazgos hasta ahora")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Módulos" })).toBeVisible();
    expect(urls[0]).toContain(`/api/projects/${PROJECT_ID}/runs/${RUN_ID}/progress`);
  });

  test("al terminar lo avisa y ofrece ver los resultados", async ({ page }) => {
    await active(page);
    await mockProgress(page, [
      { event: "snapshot", data: runningRun() },
      { event: "end", data: completedRun() },
    ]);
    await page.goto(`${BASE}/runs/current`);
    await expect(page.getByText("Ejecución n.º 3 terminada")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver resultados" })).toHaveAttribute(
      "href",
      new RegExp(`${BASE}/runs/${RUN_ID}$`),
    );
    await expect(page.getByRole("button", { name: "Cancelar ejecución" })).toHaveCount(0);
  });

  test("cancelar pide confirmación y envía la cancelación", async ({ page }) => {
    await active(page);
    await mockProgress(page, [{ event: "snapshot", data: runningRun() }]);
    const cancelling = runningRun({ cancel_requested_at: "2026-11-17T09:11:00Z" });
    const calls = await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs/${RUN_ID}/cancel`,
      { status: 202, body: cancelling },
      "POST",
    );
    // Tras pedir la cancelación, `getRun` la refleja (el simulador repite su ejemplo).
    await page.route(`**/api/projects/${PROJECT_ID}/runs/${RUN_ID}`, (route) =>
      route.request().method() === "GET" && calls.length > 0
        ? route.fulfill({ json: cancelling })
        : route.fallback(),
    );
    await page.goto(`${BASE}/runs/current`);
    await page.getByRole("button", { name: "Cancelar ejecución" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("¿Cancelar la ejecución n.º 3?")).toBeVisible();
    await dialog.getByRole("button", { name: "Seguir ejecutando" }).click();
    await expect(dialog).toHaveCount(0);
    expect(calls).toHaveLength(0);

    await page.getByRole("button", { name: "Cancelar ejecución" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar ejecución" }).click();
    await expect(page.getByText("Se pidió cancelar la ejecución n.º 3")).toBeVisible();
    expect(calls).toHaveLength(1);
    await expect(page.getByText("Cancelando…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar ejecución" })).toBeDisabled();
  });

  test("cancelar una ejecución que ya terminó lo explica", async ({ page }) => {
    await active(page);
    await mockProgress(page, [{ event: "snapshot", data: runningRun() }]);
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs/${RUN_ID}/cancel`,
      { status: 409, body: problem(409, "run.not_active") },
      "POST",
    );
    await page.goto(`${BASE}/runs/current`);
    await page.getByRole("button", { name: "Cancelar ejecución" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar ejecución" }).click();
    await expect(page.getByText("La ejecución ya terminó.")).toBeVisible();
  });

  test("si se pierde el stream lo avisa", async ({ page }) => {
    await active(page);
    await mockProgress(page, [], 503);
    await page.goto(`${BASE}/runs/current`);
    await expect(page.getByText("Se perdió la conexión en vivo")).toBeVisible();
    // La última foto de `getRun` sigue visible.
    await expect(page.getByRole("progressbar", { name: "Avance de la ejecución" })).toBeVisible();
  });

  test("sin ejecución activa ofrece iniciar una nueva", async ({ page }) => {
    await page.goto(`${BASE}/runs/current`);
    await expect(page.getByText("No hay una ejecución en curso")).toBeVisible();
    await page.getByRole("link", { name: "Nueva ejecución" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/new$`));
  });
});

test.describe("V-27 resultados", () => {
  const RUN = `**/api/projects/${PROJECT_ID}/runs/${RUN_ID}`;
  const latest = (page: Parameters<typeof mockBff>[0]) =>
    mockBff(
      page,
      PROJECT,
      {
        body: project({ last_run: runningSummary({ status: "completed", end_reason: "normal" }) }),
      },
      "GET",
    );
  /** `listFindings` por estado: solo se lee `total` en la comparación. */
  const findingsByStatus = (page: Parameters<typeof mockBff>[0]) =>
    page.route(new RegExp(`/api/projects/${PROJECT_ID}/findings\\?`), async (route) => {
      const url = new URL(route.request().url());
      const status = url.searchParams.getAll("status");
      const totals: Record<string, number> = { new: 1, persistent: 4, regression: 0 };
      const total = status.length === 1 ? (totals[status[0]] ?? 0) : 2;
      await route.fulfill({
        json: { items: total > 0 ? [finding()] : [], total, page: 1, page_size: 3 },
      });
    });

  test("resume la ejecución terminada con la comparación y la severidad", async ({ page }) => {
    await latest(page);
    await findingsByStatus(page);
    await mockBff(page, RUN, { body: completedRun() }, "GET");
    await page.goto(`${BASE}/runs/${RUN_ID}`);
    await expect(page.getByRole("heading", { name: "Ejecución n.º 3", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2 hallazgos" })).toBeVisible();
    await expect(page.getByText(/^Completada · /)).toBeVisible();
    await expect(page.getByText("Fin: normal")).toBeVisible();
    await expect(page.getByText("Contrato n.º 2")).toBeVisible();
    await expect(page.getByText("38 / 120")).toBeVisible();
    await expect(page.getByText("3 / 7")).toBeVisible();

    const comparison = page.getByRole("region", { name: "Frente a la ejecución n.º 2" });
    await expect(comparison.getByRole("listitem").filter({ hasText: "Nuevos" })).toContainText("1");
    await expect(
      comparison.getByRole("listitem").filter({ hasText: "Persistentes" }),
    ).toContainText("4");

    const modules = page.getByRole("region", { name: "Módulos" });
    await expect(modules.getByRole("listitem").filter({ hasText: "Inyección SQL" })).toContainText(
      "Ejecutado",
    );
    await expect(modules.getByRole("listitem").filter({ hasText: "Autenticación" })).toContainText(
      "No seleccionado",
    );

    await expect(
      page.getByRole("link", { name: /Acceso a un objeto de otra identidad/ }),
    ).toHaveAttribute("href", new RegExp(`${BASE}/findings/0192e3a0-8888-7000-8000-000000000001$`));
    await expect(page.getByRole("link", { name: "Ver hallazgos" })).toHaveAttribute(
      "href",
      new RegExp(`${BASE}/findings\\?run=${RUN_ID}$`),
    );
    await expect(page.getByRole("heading", { name: "Avisos" })).toHaveCount(0);
  });

  test("un resultado parcial y los recursos sin borrar se avisan", async ({ page }) => {
    await latest(page);
    await mockBff(
      page,
      RUN,
      {
        body: {
          ...completedRun(),
          end_reason: "limit_reached",
          created_resources: { pending: 0, deleted: 2, failed: 2 },
        },
      },
      "GET",
    );
    await page.goto(`${BASE}/runs/${RUN_ID}`);
    await expect(page.getByText("Fin: se alcanzó un límite")).toBeVisible();
    await expect(page.getByText("Resultado parcial")).toBeVisible();
    await expect(page.getByText("2 recursos de prueba no se pudieron borrar")).toBeVisible();
  });

  test("una ejecución que no es la última no muestra la comparación", async ({ page }) => {
    await mockBff(page, RUN, { body: completedRun() }, "GET");
    await page.goto(`${BASE}/runs/${RUN_ID}`);
    await expect(
      page.getByText(/solo se muestra en la última ejecución del proyecto/),
    ).toBeVisible();
  });

  test("volver a probar pide confirmar los módulos de riesgo", async ({ page }) => {
    await latest(page);
    await mockBff(page, RUN, { body: completedRun() }, "GET");
    await mockProgress(page, [{ event: "snapshot", data: runningRun() }]);
    const calls = await mockBff(
      page,
      `${RUN}/rerun`,
      { status: 202, body: runningRun({ status: "queued", number: 4 }) },
      "POST",
    );
    await page.goto(`${BASE}/runs/${RUN_ID}`);
    await page.getByRole("button", { name: "Volver a probar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar y repetir" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/current$`));
    expect(calls[0].postDataJSON()).toEqual({ confirm_risk: true });
  });

  test("una ejecución en curso lleva a su avance", async ({ page }) => {
    await page.goto(`${BASE}/runs/${RUN_ID}`);
    await expect(page.getByText("La ejecución n.º 3 sigue en curso")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver el avance" })).toHaveAttribute(
      "href",
      new RegExp(`${BASE}/runs/current$`),
    );
  });

  test("una ejecución inexistente o con id inválido muestra 404", async ({ page }) => {
    await mockBff(page, RUN, { status: 404, body: problem(404, "resource.not_found") }, "GET");
    await page.goto(`${BASE}/runs/${RUN_ID}`);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await page.goto(`${BASE}/runs/3`);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });
});

test.describe("V-28 matriz de acceso", () => {
  test("muestra las operaciones por identidad con la leyenda", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3/matrix");
    await expect(page.getByRole("heading", { name: "Matriz de acceso", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /10 operaciones · 4 identidades · 4 discrepancias/ }),
    ).toBeVisible();
    await expect(page.getByText("Discrepancia: abre el hallazgo")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Cliente A/ })).toBeVisible();
    await expect(page.getByText("Credencial vencida").first()).toBeVisible();
  });

  test("«Solo discrepancias» deja únicamente las filas con discrepancia", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3/matrix");
    const toggle = page.getByRole("switch", { name: "Solo discrepancias" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("heading", { name: /4 operaciones · 4 identidades · 4 discrepancias/ }),
    ).toBeVisible();
    await expect(page.getByText("/health")).toHaveCount(0);
  });

  test("una discrepancia abre su hallazgo", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3/matrix");
    await page
      .getByRole("link", { name: /Soporte: 200 · Discrepancia/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/findings\/f0\d$/);
  });
});

test.describe("V-29 hallazgos", () => {
  test("por omisión lista los abiertos ordenados por severidad", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await expect(page.getByRole("heading", { name: "Hallazgos", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "9 hallazgos abiertos" })).toBeVisible();
    await expect(page.getByText("Mostrando 9 de 15")).toBeVisible();
    const first = page
      .getByRole("list")
      .filter({ hasText: "Un usuario puede leer pedidos" })
      .first();
    await expect(first).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Quitar filtro «Estado: abiertos»/ }),
    ).toBeVisible();
  });

  test("filtra por severidad y por módulo y limpia los filtros", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page.getByLabel("Severidad").selectOption("high");
    await expect(page.getByRole("heading", { name: "3 hallazgos abiertos" })).toBeVisible();
    await page.getByLabel("Módulo").selectOption("auth");
    await expect(page.getByRole("heading", { name: "1 hallazgo abierto" })).toBeVisible();
    await expect(page.getByText("El token vencido sigue siendo aceptado")).toBeVisible();

    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.getByRole("heading", { name: "15 hallazgos" })).toBeVisible();
  });

  test("el motivo de descarte muestra los descartados", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page.getByLabel("Motivo de descarte").selectOption("false_positive");
    await expect(page.locator("#f-est")).toHaveValue("acceptedRisk");
    await expect(page.getByText("Falta la cabecera X-Content-Type-Options")).toBeVisible();
    await expect(page.getByText("El servidor anuncia su versión")).toHaveCount(0);
  });

  test("sin coincidencias ofrece limpiar", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page.getByLabel("Severidad").selectOption("critical");
    await page.getByLabel("Módulo").selectOption("auth");
    await expect(page.getByText("Nada coincide con tus filtros")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros", exact: true }).last().click();
    await expect(page.getByText("Nada coincide con tus filtros")).toHaveCount(0);
  });

  test("exportar incluye solo los filtrados", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page.getByLabel("Severidad").selectOption("high");
    await page.getByRole("button", { name: "Exportar a Excel" }).click();
    await expect(page.getByText("Se exportaron 3 hallazgos.")).toBeVisible();
  });

  test("un proyecto sin hallazgos invita a ejecutar", async ({ page }) => {
    await page.goto("/projects/pagos/findings");
    await expect(page.getByText("Aún no hay hallazgos")).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar a Excel" })).toBeDisabled();
  });

  test("abrir un hallazgo lleva a su detalle", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page
      .getByRole("link", { name: "Un usuario puede leer pedidos de otro usuario", exact: true })
      .click();
    await expect(page).toHaveURL(/\/findings\/f01$/);
  });
});

test.describe("V-30 detalle de hallazgo", () => {
  test("muestra esperado, observado, evidencia, corrección e historial", async ({ page }) => {
    await page.goto("/projects/pedidos/findings/f01");
    await expect(
      page.getByRole("heading", {
        name: "Un usuario puede leer pedidos de otro usuario",
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByText("Severidad crítica")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Esperado según la política «Solo propietario»/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Observado como Soporte" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evidencia de la ejecución 3" })).toBeVisible();
    await expect(page.getByText("Authorization: Bearer ••••••••••a9F2")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cómo corregirlo" })).toBeVisible();
    await expect(page.getByText("Detectado por primera vez en la ejecución 1")).toBeVisible();
    await expect(page.getByRole("link", { name: /CWE-639/ })).toHaveAttribute(
      "href",
      "https://cwe.mitre.org/data/definitions/639.html",
    );
  });

  test("copiar como curl deja el comando en el portapapeles", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/projects/pedidos/findings/f01");
    await page.getByRole("button", { name: "Copiar como curl" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("curl https://");
  });

  test("aceptar el riesgo, verlo descartado y revertirlo", async ({ page }) => {
    await page.goto("/projects/pedidos/findings/f01");
    await page.getByRole("button", { name: "Aceptar el riesgo" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /Falso positivo/ }).check();
    await dialog.getByRole("textbox").fill("El balanceador responde así a propósito.");
    await dialog.getByRole("button", { name: "Descartar hallazgo" }).click();
    // El modal sale con animación: se espera a que termine antes de leer la página.
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Hallazgo descartado como falso positivo")).toBeVisible();
    await expect(page.getByText("Descartado como falso positivo", { exact: true })).toBeVisible();
    await expect(
      page.locator("#main").getByText("El balanceador responde así a propósito."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceptar el riesgo" })).toHaveCount(0);

    // Ya no cuenta entre los abiertos de la lista.
    await page.goto("/projects/pedidos/findings");
    await expect(page.getByRole("heading", { name: "8 hallazgos abiertos" })).toBeVisible();

    await page.goto("/projects/pedidos/findings/f01");
    await page.getByRole("button", { name: "Revertir" }).click();
    await expect(page.getByText("El hallazgo volvió a «Persistente»")).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceptar el riesgo" })).toBeVisible();
  });

  test("un hallazgo que no existe responde 404", async ({ page }) => {
    await page.goto("/projects/pedidos/findings/f99");
    await expect(page.getByText("Hallazgo no encontrado").first()).toBeVisible();
  });
});
