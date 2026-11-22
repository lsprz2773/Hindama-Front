import { expect, test } from "./fixtures";
import { PROJECT_ID } from "./support/projects";

/**
 * Recorre la app siguiendo los enlaces internos de cada pantalla y comprueba que ninguno lleve
 * a un 404 ni a un error: todas las vistas deben poder alcanzarse navegando.
 */
const NOT_FOUND = "No encontramos esta página";
const SKIP = [/^\/design-system/, /^\/api\//, /^\/en(\/|$)/, /^\/sign-in$/, /^\/sign-up$/];

test.describe("navegación entre vistas", () => {
  // Recorre también las pantallas de administración, que se muestran según el rol de `getMe`.
  test.use({ role: "admin" });
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
      // Las vistas conectadas pintan sus enlaces cuando responde la API.
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
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
      `/projects/${PROJECT_ID}`,
      `/projects/${PROJECT_ID}/settings`,
      `/projects/${PROJECT_ID}/verification`,
      `/projects/${PROJECT_ID}/contract`,
      `/projects/${PROJECT_ID}/identities`,
      `/projects/${PROJECT_ID}/resources`,
      `/projects/${PROJECT_ID}/policy`,
      `/projects/${PROJECT_ID}/history`,
      `/projects/${PROJECT_ID}/findings`,
      `/projects/${PROJECT_ID}/runs/new`,
      "/admin/audit-log",
      "/profile",
    ]) {
      expect(visited, `No se alcanzó ${expected}`).toContain(expected);
    }
  });

  test("las vistas más profundas se alcanzan con clics desde el historial", async ({ page }) => {
    // TODO(api): la matriz y los hallazgos (fases 5 y 6) siguen con el proyecto de ejemplo.
    await page.goto("/projects/pedidos/history");
    await page.getByRole("link", { name: "Abrir" }).first().click();
    await expect(page).toHaveURL(/\/runs\/3$/);
    await page.getByRole("tab", { name: "Matriz de acceso" }).click();
    await expect(page).toHaveURL(/\/runs\/3\/matrix$/);
    // Un solo clic: repetirlo cancelaría la navegación mientras compila la vista de destino.
    await page
      .getByRole("link", { name: /Soporte: 200 · Discrepancia/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/findings\/f\d+$/, { timeout: 30_000 });
    await page.getByRole("link", { name: "Hallazgos", exact: true }).first().click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/findings$/);
  });
});
