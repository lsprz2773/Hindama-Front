import { expect, test } from "./fixtures";
import { mockBff, problem } from "./support/bff";
import { finding, FINDING_ID, findingDetail, OCCURRENCE } from "./support/findings";
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

test.describe("V-28 matriz", () => {
  const RESULTS = new RegExp(`/api/projects/${PROJECT_ID}/runs/${RUN_ID}/results`);
  const MATRIX = `${BASE}/runs/${RUN_ID}/matrix`;
  /** Una celda del ejemplo `ResultPage`. */
  const RESULT = {
    module: "object_access",
    operation: {
      id: "0192e3a0-5555-7000-8000-000000000003",
      method: "GET",
      path: "/orders/{orderId}",
    },
    identity: { id: "0192e3a0-6666-7000-8000-000000000004", name: "Cliente B", deleted: false },
    expected: "denied",
    observed: "200 allowed",
    verdict: "fail",
    evaluated_at: "2026-11-17T09:10:21Z",
  };

  test("cruza cada operación con cada identidad y marca las discrepancias", async ({ page }) => {
    await page.goto(MATRIX);
    await expect(page.getByRole("heading", { name: "Matriz de acceso", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "1 fila · 2 identidades · 1 discrepancia" }),
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cliente B" })).toBeVisible();
    await expect(
      page.getByRole("group", {
        name: "Cliente B: Discrepancia, 200 permitido, esperado: denegado",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", {
        name: "Cliente A: Correcto, 200 solo sus datos, esperado: solo sus datos",
      }),
    ).toBeVisible();
    await expect(page.getByRole("rowheader", { name: /\/orders\/\{orderId\}/ })).toContainText(
      "Acceso a objetos",
    );
  });

  test("los filtros de discrepancias y de módulo se piden a la API", async ({ page }) => {
    await page.goto(MATRIX);
    await expect(page.getByRole("heading", { name: /1 discrepancia/ })).toBeVisible();

    const fails = page.waitForRequest(
      (r) => RESULTS.test(r.url()) && r.url().includes("verdict=fail"),
    );
    await page.getByRole("switch", { name: "Solo discrepancias" }).click();
    expect(new URL((await fails).url()).searchParams.get("page_size")).toBe("500");

    const byModule = page.waitForRequest(
      (r) => RESULTS.test(r.url()) && r.url().includes("module=sql_injection"),
    );
    await page.getByLabel("Módulo").selectOption({ label: "Inyección SQL" });
    await byModule;
  });

  test("sin discrepancias lo dice en positivo", async ({ page }) => {
    await page.route(RESULTS, (route) =>
      route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 500 } }),
    );
    await page.goto(MATRIX);
    await expect(page.getByText("Esta ejecución no tiene resultados")).toBeVisible();
    await page.getByRole("switch", { name: "Solo discrepancias" }).click();
    await expect(page.getByText("No hay discrepancias")).toBeVisible();
  });

  test("pagina de 500 en 500", async ({ page }) => {
    let last = "";
    await page.route(RESULTS, async (route) => {
      last = route.request().url();
      const current = Number(new URL(last).searchParams.get("page") ?? "1");
      await route.fulfill({ json: { items: [RESULT], total: 600, page: current, page_size: 500 } });
    });
    await page.goto(MATRIX);
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    expect(new URL(last).searchParams.get("page")).toBe("2");
  });

  test("un id de ejecución inválido muestra 404", async ({ page }) => {
    await page.goto(`${BASE}/runs/3/matrix`);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });
});

test.describe("V-29 hallazgos", () => {
  const FINDINGS = new RegExp(`/api/projects/${PROJECT_ID}/findings\\?`);
  const params = (url: string) => new URL(url).searchParams;

  test("por omisión pide los abiertos y los lista con su clasificación", async ({ page }) => {
    const first = page.waitForRequest((r) => FINDINGS.test(r.url()));
    await page.goto(`${BASE}/findings`);
    expect(params((await first).url()).getAll("status")).toEqual([
      "new",
      "persistent",
      "regression",
    ]);
    await expect(page.getByRole("heading", { name: "Hallazgos", level: 1 })).toBeVisible();
    await expect(
      page.getByText("Estado actual del proyecto, con los resultados de la ejecución n.º 1."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "2 hallazgos abiertos" })).toBeVisible();
    await expect(page.getByText("Mostrando 2 de 2")).toBeVisible();
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "Acceso a un objeto de otra identidad" });
    await expect(row).toContainText("API1:2023");
    await expect(row).toContainText("CWE-639");
    await expect(row).toContainText("Cliente B");
    await expect(row).toContainText("Persistente");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Falta la cabecera Strict-Transport-Security" }),
    ).toContainText("Toda la API");
    await expect(
      page.getByRole("button", { name: /Quitar filtro «Estado: abiertos»/ }),
    ).toBeVisible();
  });

  test("los filtros de severidad, módulo y estado se piden a la API", async ({ page }) => {
    await page.goto(`${BASE}/findings`);
    await expect(page.getByRole("heading", { name: "2 hallazgos abiertos" })).toBeVisible();

    const bySeverity = page.waitForRequest(
      (r) => FINDINGS.test(r.url()) && r.url().includes("severity=high"),
    );
    await page.getByLabel("Severidad").selectOption("high");
    await bySeverity;
    const byModule = page.waitForRequest(
      (r) => FINDINGS.test(r.url()) && r.url().includes("module=object_access"),
    );
    await page.getByLabel("Módulo").selectOption({ label: "Acceso a objetos" });
    await byModule;
    const byStatus = page.waitForRequest(
      (r) => FINDINGS.test(r.url()) && params(r.url()).getAll("status").join() === "accepted_risk",
    );
    await page.getByLabel("Estado", { exact: true }).selectOption("accepted_risk");
    await byStatus;

    const cleared = page.waitForRequest(
      (r) =>
        FINDINGS.test(r.url()) && !r.url().includes("status=") && !r.url().includes("severity="),
    );
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await cleared;
    await expect(page.getByRole("heading", { name: "2 hallazgos", exact: true })).toBeVisible();
  });

  test("desde una ejecución filtra por ella y el filtro se puede quitar", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs/${RUN_ID}`,
      { body: completedRun() },
      "GET",
    );
    const first = page.waitForRequest((r) => FINDINGS.test(r.url()));
    await page.goto(`${BASE}/findings?run=${RUN_ID}`);
    expect(params((await first).url()).get("run_id")).toBe(RUN_ID);
    await expect(page.getByText("Ejecución n.º 3")).toBeVisible();
    const all = page.waitForRequest((r) => FINDINGS.test(r.url()) && !r.url().includes("run_id="));
    await page.getByRole("button", { name: "Quitar filtro «Ejecución»" }).click();
    await all;
  });

  test("un id de ejecución inválido en la dirección se ignora", async ({ page }) => {
    const first = page.waitForRequest((r) => FINDINGS.test(r.url()));
    await page.goto(`${BASE}/findings?run=3`);
    expect(params((await first).url()).get("run_id")).toBeNull();
  });

  test("sin coincidencias ofrece limpiar", async ({ page }) => {
    await page.route(FINDINGS, (route) =>
      route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } }),
    );
    await page.goto(`${BASE}/findings`);
    await expect(page.getByText("Nada coincide con tus filtros")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros", exact: true }).last().click();
    await expect(page.getByText("Este proyecto no tiene hallazgos.")).toBeVisible();
  });

  test("pagina de 20 en 20", async ({ page }) => {
    let last = "";
    await page.route(FINDINGS, (route) => {
      last = route.request().url();
      const current = Number(params(last).get("page") ?? "1");
      return route.fulfill({
        json: { items: [finding()], total: 45, page: current, page_size: 20 },
      });
    });
    await page.goto(`${BASE}/findings`);
    await expect(page.getByText("Página 1 de 3")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Página 2 de 3")).toBeVisible();
    expect(params(last).get("page")).toBe("2");
    expect(params(last).get("page_size")).toBe("20");
  });

  test("un proyecto sin ejecuciones invita a ejecutar", async ({ page }) => {
    await mockBff(page, PROJECT, { body: project({ last_run: null }) }, "GET");
    await page.goto(`${BASE}/findings`);
    await expect(page.getByText("Aún no hay hallazgos")).toBeVisible();
    await expect(page.getByText("Aún no hay ejecuciones en este proyecto.")).toBeVisible();
  });

  test("abrir un hallazgo lleva a su detalle", async ({ page }) => {
    await page.goto(`${BASE}/findings`);
    await page
      .getByRole("link", { name: "Acceso a un objeto de otra identidad", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`${BASE}/findings/0192e3a0-8888-7000-8000-000000000001$`),
    );
  });
});

test.describe("V-30 detalle de hallazgo", () => {
  const DETAIL = `**/api/projects/${PROJECT_ID}/findings/${FINDING_ID}`;
  const URL_DETAIL = `${BASE}/findings/${FINDING_ID}`;
  const dismissed = (reason = "false_positive") =>
    findingDetail({
      status: "accepted_risk",
      dismissal: {
        reason,
        justification: "El balanceador responde así a propósito.",
        dismissed_at: "2026-11-18T10:00:00Z",
      },
    });

  test("muestra la explicación, la evidencia, la corrección y el historial", async ({ page }) => {
    await page.goto(URL_DETAIL);
    await expect(
      page.getByRole("heading", { name: "Acceso a un objeto de otra identidad", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Severidad alta")).toBeVisible();
    await expect(page.getByText("De la ejecución n.º 2 a la n.º 3")).toBeVisible();
    await expect(page.getByRole("link", { name: /CWE-639/ })).toHaveAttribute(
      "href",
      "https://cwe.mitre.org/data/definitions/639.html",
    );
    await expect(page.getByRole("link", { name: /CWE-639/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    await expect(
      page.getByRole("heading", { name: "Por qué es una falla · Cliente B" }),
    ).toBeVisible();
    await expect(
      page.getByText(/obtuvo el recurso «1001» \(order\) de «Cliente A»/).first(),
    ).toBeVisible();
    await expect(page.getByText("Recurso: order «1001» de Cliente A")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Evidencia de la ejecución n.º 3" }),
    ).toBeVisible();
    const request = page
      .getByRole("region", { name: "Evidencia de la ejecución n.º 3" })
      .getByLabel("Petición");
    await expect(request).toContainText("GET https://api.ejemplo.com/v1/orders/1001");
    await expect(request).toContainText("authorization: ****x9Qz");
    await expect(page.getByRole("heading", { name: "Cómo corregirlo" })).toBeVisible();
    await expect(
      page.getByText(/pertenece al usuario autenticado antes de devolverlo/),
    ).toBeVisible();
    const history = page.getByRole("region", { name: "Historial" });
    await expect(history.getByRole("listitem")).toHaveCount(2);
    await expect(history.getByRole("listitem").first()).toContainText("Ejecución n.º 2");
    await expect(history.getByRole("listitem").first()).toContainText("Detectado");
  });

  test("copiar como curl deja el comando con la credencial enmascarada", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(URL_DETAIL);
    await page.getByRole("button", { name: "Copiar como curl" }).click();
    const curl = await page.evaluate(() => navigator.clipboard.readText());
    expect(curl).toContain("curl -X GET 'https://api.ejemplo.com/v1/orders/1001'");
    expect(curl).toContain("-H 'authorization: ****x9Qz'");
  });

  test("la evidencia se muestra como texto aunque traiga HTML", async ({ page }) => {
    const occurrence = {
      ...OCCURRENCE,
      evidence: {
        ...OCCURRENCE.evidence,
        response: {
          ...OCCURRENCE.evidence.response,
          body: '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>',
          body_truncated: true,
        },
      },
    };
    await mockBff(page, DETAIL, { body: findingDetail({ last_occurrence: occurrence }) }, "GET");
    await page.goto(URL_DETAIL);
    await expect(page.getByText("Cuerpo recortado a 10 KB")).toBeVisible();
    await expect(page.getByText(/<img src=x onerror=/)).toBeVisible();
    await expect(page.locator("#main img")).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("aceptar el riesgo envía el motivo y la justificación y muestra el descarte", async ({
    page,
  }) => {
    const calls = await mockBff(page, `${DETAIL}/dismissal`, { body: dismissed() }, "POST");
    // Tras descartarlo, `getFinding` lo devuelve en `accepted_risk` (el simulador repite su ejemplo).
    await page.route(DETAIL, (route) =>
      route.request().method() === "GET" && calls.length > 0
        ? route.fulfill({ json: dismissed() })
        : route.fallback(),
    );
    await page.goto(URL_DETAIL);
    await page.getByRole("button", { name: "Aceptar el riesgo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Falso positivo/ }).check();
    await dialog.getByRole("textbox").fill("  El balanceador responde así a propósito.  ");
    await dialog.getByRole("button", { name: "Descartar hallazgo" }).click();
    await expect(dialog).toHaveCount(0);
    expect(calls[0].postDataJSON()).toEqual({
      reason: "false_positive",
      justification: "El balanceador responde así a propósito.",
    });
    await expect(page.getByText("Hallazgo descartado como falso positivo")).toBeVisible();
    await expect(page.getByText("Descartado como falso positivo", { exact: true })).toBeVisible();
    await expect(
      page.locator("#main").getByText("El balanceador responde así a propósito."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceptar el riesgo" })).toHaveCount(0);
  });

  test("un hallazgo que ya no está abierto lo explica en el diálogo", async ({ page }) => {
    await mockBff(
      page,
      `${DETAIL}/dismissal`,
      { status: 409, body: problem(409, "finding.not_open") },
      "POST",
    );
    await page.goto(URL_DETAIL);
    await page.getByRole("button", { name: "Aceptar el riesgo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("Riesgo asumido por el equipo.");
    await dialog.getByRole("button", { name: "Descartar hallazgo" }).click();
    await expect(dialog.getByRole("alert")).toContainText("El hallazgo ya no está abierto.");
  });

  test("revertir el descarte lo devuelve a persistente", async ({ page }) => {
    const calls = await mockBff(page, `${DETAIL}/dismissal`, { status: 204 }, "DELETE");
    await page.route(DETAIL, (route) =>
      route.request().method() === "GET" && calls.length === 0
        ? route.fulfill({ json: dismissed("accepted_risk") })
        : route.fallback(),
    );
    await page.goto(URL_DETAIL);
    await expect(page.getByText("Riesgo aceptado", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Revertir" }).click();
    await expect(page.getByText("El hallazgo volvió a «Persistente»")).toBeVisible();
    expect(calls).toHaveLength(1);
    await expect(page.getByRole("button", { name: "Aceptar el riesgo" })).toBeVisible();
  });

  test("las detecciones muestran su evidencia y llevan a su ejecución", async ({ page }) => {
    await page.goto(URL_DETAIL);
    const section = page.getByRole("region", { name: "Detecciones" });
    await section.getByText("Ejecución n.º 3").first().click();
    await expect(section.getByRole("link", { name: "Ver la ejecución n.º 3" })).toHaveAttribute(
      "href",
      new RegExp(`${BASE}/runs/0192e3a0-7777-7000-8000-000000000003$`),
    );
  });

  test("un hallazgo que no existe responde 404", async ({ page }) => {
    await mockBff(page, DETAIL, { status: 404, body: problem(404, "resource.not_found") }, "GET");
    await page.goto(URL_DETAIL);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await page.goto(`${BASE}/findings/f01`);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });
});
