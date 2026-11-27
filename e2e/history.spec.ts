import { expect, test } from "./fixtures";
import { mockBff, problem } from "./support/bff";
import { finding, findingDetail } from "./support/findings";
import { project, PROJECT_ID } from "./support/projects";
import { completedRun, mockProgress, RUN_ID, runningRun, runningSummary } from "./support/runs";

const PROJECT = `**/api/projects/${PROJECT_ID}`;
const RUNS = new RegExp(`/api/projects/${PROJECT_ID}/runs(\\?.*)?$`);
const BASE = `/projects/${PROJECT_ID}`;
const DONE_ID = "0192e3a0-7777-7000-8000-000000000002";

function completed(
  number: number,
  id = `0192e3a0-7777-7000-8000-${String(number).padStart(12, "0")}`,
) {
  return runningSummary({
    id,
    number,
    status: "completed",
    end_reason: "normal",
    finished_at: "2026-11-17T09:14:37Z",
  });
}

test.describe("V-31 historial del proyecto", () => {
  test("lista las ejecuciones de `listRuns` con su estado, duración y severidad", async ({
    page,
  }) => {
    await page.goto(`${BASE}/history`);
    await expect(page.getByRole("heading", { name: "Historial", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aún no está concluido" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2 ejecuciones" })).toBeVisible();

    const rows = page.getByRole("listitem").filter({ hasText: /^n\.º \d/ });
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("En curso");
    await expect(rows.nth(0)).toContainText("3 módulos");
    await expect(rows.nth(1)).toContainText("Completada");
    await expect(rows.nth(1)).toContainText("4:36");
    await expect(rows.nth(1)).toContainText("318");
    // Abiertos ahora (`open_findings_by_severity`) y resueltos (`listFindings` con `status=resolved`).
    await expect(page.getByText("Abiertos ahora")).toBeVisible();
    await expect(page.getByText("Resueltos en total")).toBeVisible();
  });

  test("la gráfica describe los hallazgos detectados en cada ejecución", async ({ page }) => {
    await page.goto(`${BASE}/history`);
    await expect(
      page.getByRole("img", {
        name: "Hallazgos detectados: ejecución 2, 11; ejecución 3 en curso, 2 hasta ahora.",
      }),
    ).toBeVisible();
    await expect(page.getByText("La n.º 3 sigue en curso")).toBeVisible();
  });

  test("la ejecución en curso lleva al progreso y una terminada a sus resultados y reporte", async ({
    page,
  }) => {
    await page.goto(`${BASE}/history`);
    await expect(
      page.getByRole("link", { name: "Ver el progreso de la ejecución n.º 3" }),
    ).toHaveAttribute("href", new RegExp(`${BASE}/runs/current$`));
    await expect(page.getByRole("link", { name: "Reporte de la ejecución n.º 2" })).toHaveAttribute(
      "href",
      new RegExp(`${BASE}/runs/${DONE_ID}/report$`),
    );
    await page.getByRole("link", { name: "Abrir la ejecución n.º 2" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/${DONE_ID}$`));
  });

  test("el filtro de estado se envía a la API", async ({ page }) => {
    const urls: string[] = [];
    await page.route(RUNS, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const url = new URL(route.request().url());
      urls.push(url.search);
      const only = url.searchParams.getAll("status");
      const items = only.includes("cancelled") ? [] : [completed(2, DONE_ID)];
      await route.fulfill({ json: { items, total: items.length, page: 1, page_size: 20 } });
    });
    await page.goto(`${BASE}/history`);
    await expect(page.getByRole("heading", { name: "1 ejecución" })).toBeVisible();
    await page.getByLabel("Estado", { exact: true }).selectOption("cancelled");
    await expect(page.getByText("Ninguna ejecución tiene ese estado.")).toBeVisible();
    expect(urls.some((u) => u.includes("status=cancelled"))).toBe(true);
  });

  test("pagina de 20 en 20", async ({ page }) => {
    const pages: string[] = [];
    await page.route(RUNS, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const url = new URL(route.request().url());
      const n = Number(url.searchParams.get("page") ?? "1");
      pages.push(String(n));
      const items = n === 1 ? [completed(25)] : [completed(5)];
      await route.fulfill({ json: { items, total: 25, page: n, page_size: 20 } });
    });
    await page.goto(`${BASE}/history`);
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir la ejecución n.º 5" })).toBeVisible();
    expect(pages).toContain("2");
  });

  test("repetir la última ejecución confirma los módulos de riesgo y va al progreso", async ({
    page,
  }) => {
    await mockProgress(page, [{ event: "snapshot", data: runningRun() }]);
    await mockBff(
      page,
      PROJECT,
      { body: project({ last_run: completed(1, "0192e3a0-4444-7000-8000-000000000001") }) },
      "GET",
    );
    const calls = await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs/*/rerun`,
      { status: 202, body: runningRun({ status: "queued" }) },
      "POST",
    );
    await page.goto(`${BASE}/history`);
    await page.getByRole("button", { name: "Repetir última ejecución" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Inyección SQL")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar y repetir" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/current$`));
    expect(calls[0].url()).toContain("/runs/0192e3a0-4444-7000-8000-000000000001/rerun");
    expect(calls[0].postDataJSON()).toEqual({ confirm_risk: true });
  });

  test("con una ejecución activa se ofrece ver su progreso en lugar de repetir", async ({
    page,
  }) => {
    await mockBff(page, PROJECT, { body: project({ last_run: runningSummary() }) }, "GET");
    await page.goto(`${BASE}/history`);
    await expect(page.getByRole("link", { name: "Ver progreso", exact: true })).toHaveAttribute(
      "href",
      new RegExp(`${BASE}/runs/current$`),
    );
    await expect(page.getByRole("button", { name: "Repetir última ejecución" })).toHaveCount(0);
  });

  test("un proyecto sin ejecuciones invita a crear la primera", async ({ page }) => {
    await mockBff(page, PROJECT, { body: project({ last_run: null }) }, "GET");
    await page.goto(`${BASE}/history`);
    await expect(page.getByText("Aún no hay ejecuciones")).toBeVisible();
    await page.getByRole("link", { name: "Nueva ejecución" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/new$`));
  });

  test("un proyecto concluido lo indica", async ({ page }) => {
    await mockBff(page, PROJECT, { body: project({ concluded: true }) }, "GET");
    await page.goto(`${BASE}/history`);
    await expect(page.getByRole("heading", { name: "Proyecto concluido" })).toBeVisible();
  });

  test("un error del historial muestra su identificador", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs**`,
      { status: 500, body: problem(500, "internal") },
      "GET",
    );
    await page.goto(`${BASE}/history`);
    await expect(page.getByText("Referencia: req-e2e-500")).toBeVisible();
  });
});

const REPORT = `${BASE}/runs/${RUN_ID}/report`;
const RUN = `**/api/projects/${PROJECT_ID}/runs/${RUN_ID}`;
const FAIL = {
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

/** La ejecución del reporte ya terminada (el simulador la devuelve en curso). */
async function finished(page: import("@playwright/test").Page, latest = false) {
  await mockBff(page, RUN, { body: completedRun() }, "GET");
  const results = await mockBff(
    page,
    `${RUN}/results**`,
    { body: { items: [FAIL], total: 1, page: 1, page_size: 500 } },
    "GET",
  );
  if (latest)
    await mockBff(page, PROJECT, { body: project({ last_run: completed(3, RUN_ID) }) }, "GET");
  return results;
}

test.describe("V-32 reporte imprimible", () => {
  test("resume la ejecución con sus discrepancias y hallazgos de la API", async ({ page }) => {
    const results = await finished(page);
    await page.goto(REPORT);
    await expect(page.getByRole("heading", { name: "API de pedidos", level: 1 })).toBeVisible();
    await expect(page.getByText("Reporte de la ejecución n.º 3")).toBeVisible();
    await expect(page.getByText(/^Ejecución completada el/)).toBeVisible();
    await expect(page.getByText("api.tienda-ejemplo.com")).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. Resumen" })).toBeVisible();
    const severity = page.getByRole("table", { name: "Por severidad" });
    await expect(severity.getByRole("row", { name: "Alta 2" })).toBeVisible();
    // `Run.limits` y `progress.requests_sent`.
    await expect(page.getByText(/Límites: 5 peticiones por segundo, 2 concurrentes/)).toBeVisible();
    await expect(page.getByText(/Se enviaron 42 peticiones en 4:35/)).toBeVisible();

    await expect(page.getByRole("heading", { name: /2\. Matriz de acceso/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: /GET \/orders\/\{orderId\}/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Cliente B" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "! 200 permitido" })).toBeVisible();
    expect(new URL(results[0].url()).searchParams.getAll("verdict")).toEqual(["fail"]);

    await expect(page.getByRole("heading", { name: "3. Hallazgos" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "3.1 Acceso a un objeto de otra identidad" }),
    ).toBeVisible();
    await expect(page.getByText("De la n.º 2 a la n.º 3").first()).toBeVisible();
  });

  test("los hallazgos de la variante de ejecución se piden con su `run_id`", async ({ page }) => {
    await finished(page);
    const urls: string[] = [];
    await page.route(new RegExp(`/api/projects/${PROJECT_ID}/findings\\?`), async (route) => {
      urls.push(route.request().url());
      await route.fallback();
    });
    await page.goto(REPORT);
    await expect(page.getByRole("heading", { name: "3. Hallazgos" })).toBeVisible();
    await expect.poll(() => urls.some((u) => u.includes(`run_id=${RUN_ID}`))).toBe(true);
    // No es la última ejecución del proyecto: su estado actual no es su resultado.
    await expect(
      page.getByText("El estado de los hallazgos solo se muestra para la última ejecución."),
    ).toBeVisible();
  });

  test("en la última ejecución cuenta los hallazgos por estado", async ({ page }) => {
    await finished(page, true);
    await page.goto(REPORT);
    const status = page.getByRole("table", { name: "Por estado" });
    await expect(status.getByRole("row", { name: /^Nuevo/ })).toBeVisible();
    await expect(status.getByRole("row", { name: /^Persistente/ })).toBeVisible();
    await expect(status.getByRole("row", { name: /^Regresión/ })).toBeVisible();
  });

  test("la variante «Estado actual» usa los abiertos del proyecto", async ({ page }) => {
    await finished(page);
    const urls: string[] = [];
    await page.route(new RegExp(`/api/projects/${PROJECT_ID}/findings\\?`), async (route) => {
      urls.push(route.request().url());
      await route.fallback();
    });
    await page.goto(REPORT);
    await expect(page.getByRole("radio", { name: "Ejecución n.º 3" })).toBeChecked();
    await page.getByRole("radio", { name: "Estado actual" }).click();
    await expect(page.getByRole("radio", { name: "Estado actual" })).toBeChecked();
    await expect(page.getByText("Reporte del estado actual")).toBeVisible();
    await expect(page.getByText(/con 1 ejecución$/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /2\. Matriz de acceso/ })).toHaveCount(0);
    // `open_findings_by_severity` del proyecto.
    await expect(
      page.getByRole("table", { name: "Por severidad" }).getByRole("row", { name: "Crítica 1" }),
    ).toBeVisible();
    await expect(page.getByRole("table", { name: "Por estado" })).toContainText(
      "Resueltos en total",
    );
    await expect
      .poll(() =>
        urls.some(
          (u) =>
            !u.includes("run_id") && u.includes("status=new&status=persistent&status=regression"),
        ),
      )
      .toBe(true);
  });

  test("imprimir abre el diálogo del navegador y no ofrece exportar a Excel", async ({ page }) => {
    await finished(page);
    await page.goto(REPORT);
    await page.evaluate(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
    await page.getByRole("button", { name: "Imprimir o guardar PDF" }).click();
    await expect(page.getByText("Preparando la impresión…")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed))
      .toBe(1);
    await expect(page.getByRole("button", { name: "Hallazgos en Excel" })).toHaveCount(0);
  });

  test("al imprimir se ocultan los controles y la hoja queda blanca", async ({ page }) => {
    await finished(page);
    await page.goto(REPORT);
    await expect(page.getByRole("heading", { name: "1. Resumen" })).toBeVisible();
    await page.emulateMedia({ media: "print", colorScheme: "dark" });
    await expect(page.getByRole("button", { name: "Imprimir o guardar PDF" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Volver" })).toBeHidden();
    const sheet = page.locator("article.print-sheet");
    await expect(sheet).toBeVisible();
    expect(await sheet.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgb(255, 255, 255)",
    );
    expect(await sheet.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(28, 25, 21)");
  });

  test("volver regresa a los resultados de la ejecución", async ({ page }) => {
    await finished(page);
    await page.goto(REPORT);
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/runs/${RUN_ID}$`));
  });

  test("una ejecución en curso aún no tiene reporte", async ({ page }) => {
    await page.goto(REPORT);
    await expect(page.getByText("La ejecución sigue en curso")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver progreso" })).toHaveAttribute(
      "href",
      new RegExp(`${BASE}/runs/current$`),
    );
  });

  test("un id que no es UUID o una ejecución inexistente responden 404", async ({ page }) => {
    await page.goto(`${BASE}/runs/3/report`);
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
    await mockBff(page, RUN, { status: 404, body: problem(404, "resource.not_found") }, "GET");
    await page.goto(REPORT);
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
  });
});

test.describe("V-32 evidencia y recomendación de cada hallazgo", () => {
  const LIST = new RegExp(`/api/projects/${PROJECT_ID}/findings\\?`);
  const DETAIL = new RegExp(`/api/projects/${PROJECT_ID}/findings/[0-9a-f-]{36}$`);
  const id = (n: number) => `0192e3a0-8888-7000-8000-${String(n).padStart(12, "0")}`;
  const listOf = (count: number) => ({
    items: Array.from({ length: count }, (_, i) =>
      finding({ id: id(i + 1), title: `Hallazgo ${i + 1}` }),
    ),
    total: count,
    page: 1,
    page_size: 100,
  });

  test("cada hallazgo trae su explicación, recomendación y evidencia de getFinding", async ({
    page,
  }) => {
    await finished(page);
    await page.route(LIST, (route) => route.fulfill({ json: listOf(1) }));
    const calls: string[] = [];
    await page.route(DETAIL, async (route) => {
      calls.push(route.request().url());
      await route.fulfill({ json: findingDetail({ id: id(1) }) });
    });
    await page.goto(REPORT);
    await expect(page.getByRole("heading", { name: "3.1 Hallazgo 1" })).toBeVisible();
    await expect(page.getByText("Qué se detectó")).toBeVisible();
    await expect(page.getByText(/obtuvo el recurso «1001»/)).toBeVisible();
    await expect(page.getByText(/Comprueba en el servidor, en cada petición/)).toBeVisible();
    // La evidencia es texto de la API del analista, ya enmascarado.
    await expect(page.getByText("GET https://api.ejemplo.com/v1/orders/1001")).toBeVisible();
    await expect(page.getByText("authorization: ****x9Qz")).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`/findings/${id(1)}`);
  });

  test("pide el detalle por tandas de 30 para cuidar el límite de peticiones", async ({ page }) => {
    await finished(page);
    await page.route(LIST, (route) => route.fulfill({ json: listOf(35) }));
    const calls: string[] = [];
    await page.route(DETAIL, async (route) => {
      const url = route.request().url();
      calls.push(url);
      await route.fulfill({ json: findingDetail({ id: url.slice(-36) }) });
    });
    await page.goto(REPORT);
    await expect(page.getByRole("heading", { name: "3.30 Hallazgo 30" })).toBeVisible();
    await expect(page.getByText("Con evidencia: 30 de 35 hallazgos")).toBeVisible();
    await expect.poll(() => calls.length).toBe(30);
    // Los últimos cinco quedan sin pedir y enlazan a su detalle.
    await expect(
      page.getByText("La evidencia de este hallazgo no se cargó en el reporte."),
    ).toHaveCount(5);
    await page
      .getByRole("button", { name: "Cargar la evidencia de los siguientes 5 hallazgos" })
      .click();
    await expect.poll(() => calls.length).toBe(35);
    await expect(page.getByText("Con evidencia:")).toHaveCount(0);
  });

  test("si la API limita las peticiones, ofrece reintentar ese hallazgo", async ({ page }) => {
    await finished(page);
    await page.route(LIST, (route) => route.fulfill({ json: listOf(1) }));
    let answer = 0;
    await page.route(DETAIL, async (route) => {
      answer += 1;
      // El cliente reintenta un GET dos veces: los tres intentos de la primera carga fallan.
      if (answer <= 3)
        return route.fulfill({
          status: 429,
          contentType: "application/problem+json",
          headers: { "retry-after": "0" },
          body: JSON.stringify(problem(429, "rate_limit.exceeded")),
        });
      await route.fulfill({ json: findingDetail({ id: id(1) }) });
    });
    await page.goto(REPORT);
    await expect(page.getByText(/Demasiadas solicitudes: espera un momento/)).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText(/obtuvo el recurso «1001»/)).toBeVisible();
  });

  test("un error al cargar un hallazgo no rompe el reporte", async ({ page }) => {
    await finished(page);
    await page.route(LIST, (route) => route.fulfill({ json: listOf(2) }));
    await page.route(DETAIL, async (route) => {
      const url = route.request().url();
      if (url.endsWith(id(1)))
        return route.fulfill({
          status: 500,
          contentType: "application/problem+json",
          body: JSON.stringify(problem(500, "internal")),
        });
      await route.fulfill({ json: findingDetail({ id: id(2) }) });
    });
    await page.goto(REPORT);
    await expect(page.getByText("No se pudo cargar la evidencia de este hallazgo.")).toBeVisible();
    await expect(page.getByText(/obtuvo el recurso «1001»/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "3.2 Hallazgo 2" })).toBeVisible();
  });
});
