import { expect, test } from "./fixtures";
import { mockBff } from "./support/bff";
import { PROJECT_ID } from "./support/projects";
import { completedRun, RUN_ID } from "./support/runs";

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

  test("las vistas más profundas se alcanzan con clics desde los resultados", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs/${RUN_ID}`,
      { body: completedRun() },
      "GET",
    );
    await page.goto(`/projects/${PROJECT_ID}/runs/${RUN_ID}`);
    await page.getByRole("tab", { name: "Matriz de acceso" }).click();
    await expect(page).toHaveURL(new RegExp(`/runs/${RUN_ID}/matrix$`));
    // Un solo clic: repetirlo cancelaría la navegación mientras compila la vista de destino.
    await page.getByRole("tab", { name: /^Hallazgos/ }).click();
    await expect(page).toHaveURL(new RegExp(`/findings\\?run=${RUN_ID}$`), { timeout: 30_000 });
    await page
      .getByRole("link", { name: "Acceso a un objeto de otra identidad", exact: true })
      .click();
    await expect(page).toHaveURL(/\/findings\/0192e3a0-8888-7000-8000-000000000001$/, {
      timeout: 30_000,
    });
    await page.getByRole("link", { name: "Hallazgos", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}/findings$`));
  });
});
