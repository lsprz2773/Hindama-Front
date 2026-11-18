import { expect, test } from "./fixtures";

test.describe("V-31 historial del proyecto", () => {
  test("lista las ejecuciones con su estado, severidad y cambios", async ({ page }) => {
    await page.goto("/projects/pedidos/history");
    await expect(page.getByRole("heading", { name: "Historial", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aún no está concluido" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3 ejecuciones" })).toBeVisible();

    const rows = page.getByRole("listitem").filter({ hasText: /^n\.º \d/ });
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Completada");
    await expect(rows.nth(0)).toContainText("4 · 9 · 6 · 2");
    await expect(rows.nth(1)).toContainText("Cancelada");
    await expect(rows.nth(1)).toContainText("2 recursos por eliminar");
    await expect(rows.nth(2)).toContainText("Autenticación");
  });

  test("la gráfica describe los hallazgos abiertos de cada ejecución", async ({ page }) => {
    await page.goto("/projects/pedidos/history");
    await expect(
      page.getByRole("img", {
        name: "Hallazgos abiertos: ejecución 1, 18; ejecución 2, 17; ejecución 3, 15.",
      }),
    ).toBeVisible();
  });

  test("abrir una ejecución y su reporte lleva a cada vista", async ({ page }) => {
    await page.goto("/projects/pedidos/history");
    await page.getByRole("link", { name: "Abrir" }).first().click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/runs\/3$/);
    await page.goBack();
    await page.getByRole("link", { name: "Reporte" }).first().click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/runs\/3\/report$/);
  });

  test("repetir la última ejecución arranca una nueva y aparece en curso en el historial", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos/history");
    await page.getByRole("button", { name: "Repetir última ejecución" }).click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/runs\/current$/);

    await page.goto("/projects/pedidos/history");
    await expect(page.getByRole("heading", { name: "4 ejecuciones" })).toBeVisible();
    await expect(page.getByText("La n.º 4 sigue en curso")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver progreso" }).first()).toBeVisible();
    // Con una ejecución activa ya no se ofrece repetir.
    await expect(page.getByRole("button", { name: "Repetir última ejecución" })).toHaveCount(0);
  });

  test("un proyecto sin ejecuciones invita a crear la primera", async ({ page }) => {
    await page.goto("/projects/pagos/history");
    await expect(page.getByText("Aún no hay ejecuciones")).toBeVisible();
    await page.getByRole("link", { name: "Nueva ejecución" }).click();
    await expect(page).toHaveURL(/\/projects\/pagos\/runs\/new$/);
  });

  test("un proyecto concluido lo indica", async ({ page }) => {
    await page.goto("/projects/proveedores/history");
    await expect(page.getByRole("heading", { name: "Proyecto concluido" })).toBeVisible();
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
