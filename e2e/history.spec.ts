import { expect, test } from "./fixtures";
import { mockBff, problem } from "./support/bff";
import { project, PROJECT_ID } from "./support/projects";
import { mockProgress, runningRun, runningSummary } from "./support/runs";

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

test.describe("V-32 reporte imprimible", () => {
  test("incluye resumen, matriz de discrepancias y hallazgos con evidencia enmascarada", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos/runs/3/report");
    await expect(page.getByRole("heading", { name: "API de Pedidos", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. Resumen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /2\. Matriz de acceso/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Hallazgos" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Por severidad" })).toBeVisible();
    await expect(page.getByText("Authorization: Bearer ••••••••••a9F2")).toBeVisible();
    await expect(page.getByText(/Y 7 hallazgos más/)).toBeVisible();
  });

  test("la variante «Estado actual» cambia el título y el subtítulo", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3/report");
    await expect(page.getByRole("radio", { name: "Ejecución n.º 3" })).toBeChecked();
    await expect(page.getByText("Reporte de la ejecución n.º 3")).toBeVisible();
    await page.getByRole("radio", { name: "Estado actual" }).click();
    await expect(page.getByRole("radio", { name: "Estado actual" })).toBeChecked();
    await expect(page.getByText("Reporte del estado actual")).toBeVisible();
    await expect(page.getByText(/con 3 ejecuciones/)).toBeVisible();
  });

  test("imprimir abre el diálogo del navegador y exportar avisa", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3/report");
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

    await page.getByRole("button", { name: "Hallazgos en Excel" }).click();
    await expect(page.getByText("Exportación lista")).toBeVisible();
  });

  test("al imprimir se ocultan los controles y la hoja queda blanca", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3/report");
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
    await page.goto("/projects/pedidos/runs/3/report");
    await page.getByRole("link", { name: "Volver" }).click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/runs\/3$/);
  });

  test("una ejecución inexistente responde 404 y un proyecto sin ejecuciones lo explica", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos/runs/99/report");
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
    await page.goto("/projects/pagos/runs/1/report");
    await expect(page.getByText("Aún no hay nada que reportar")).toBeVisible();
  });
});
