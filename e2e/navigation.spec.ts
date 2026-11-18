import { expect, test } from "./fixtures";

/**
 * Recorre la app siguiendo los enlaces internos de cada pantalla y comprueba que ninguno lleve
 * a un 404 ni a un error: todas las vistas deben poder alcanzarse navegando.
 */
const NOT_FOUND = "No encontramos esta página";
const SKIP = [/^\/design-system/, /^\/api\//, /^\/en(\/|$)/, /^\/sign-in$/, /^\/sign-up$/];

test.describe("navegación entre vistas", () => {
  test("ningún enlace interno lleva a un 404", async ({ page }) => {
    test.setTimeout(420_000);
    const seen = new Set<string>();
    const queue = ["/", "/projects", "/admin"];
    const broken: string[] = [];
    const visited: string[] = [];

    while (queue.length > 0 && visited.length < 90) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);

      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      if (await page.getByText(NOT_FOUND).count()) broken.push(path);
      visited.push(path);

      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map((l) => (l as HTMLAnchorElement).getAttribute("href") ?? ""),
        );
      for (const href of hrefs) {
        if (!href.startsWith("/") || href.startsWith("//")) continue;
        const clean = href.split("#")[0].split("?")[0] || "/";
        if (SKIP.some((re) => re.test(clean)) || seen.has(clean)) continue;
        queue.push(clean);
      }
    }

    expect(broken, `Enlaces rotos: ${broken.join(", ")}`).toEqual([]);
    // Las vistas principales de cada fase se alcanzaron solo siguiendo enlaces.
    for (const expected of [
      "/projects/pedidos",
      "/projects/pedidos/settings",
      "/projects/pedidos/verification",
      "/projects/pedidos/contract",
      "/projects/pedidos/identities",
      "/projects/pedidos/resources",
      "/projects/pedidos/policy",
      "/projects/pedidos/history",
      "/projects/pedidos/findings",
      "/projects/pedidos/runs/new",
      "/admin/audit-log",
      "/profile",
    ]) {
      expect(visited, `No se alcanzó ${expected}`).toContain(expected);
    }
  });

  test("las vistas más profundas se alcanzan con clics desde el dashboard", async ({ page }) => {
    await page.goto("/projects/pedidos");
    await page.getByRole("link", { name: "Historial" }).first().click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/history$/);
    await page.getByRole("link", { name: "Abrir" }).first().click();
    await expect(page).toHaveURL(/\/runs\/3$/);
    await page.getByRole("tab", { name: "Matriz de acceso" }).click();
    await expect(page).toHaveURL(/\/runs\/3\/matrix$/);
    // La primera pulsación puede llegar antes de que la matriz termine de hidratarse.
    await expect(async () => {
      await page
        .getByRole("link", { name: /Soporte: 200 · Discrepancia/ })
        .first()
        .click();
      await expect(page).toHaveURL(/\/findings\/f\d+$/, { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("link", { name: "Hallazgos", exact: true }).first().click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/findings$/);
  });
});
