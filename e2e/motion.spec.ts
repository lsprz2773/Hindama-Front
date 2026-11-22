import { expect, test } from "./fixtures";
import { mockBff } from "./support/bff";
import { page as projectPage, project, PROJECT_ID, summary } from "./support/projects";
import { completedRun, RUN_ID } from "./support/runs";

// Las estadísticas de administración se muestran según el rol que informa `getMe`.
test.use({ role: "admin" });

const animationName = (selector: string) => (page: import("@playwright/test").Page) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);

test.describe("animaciones", () => {
  test("al cambiar de vista el contenido entra con la transición de página", async ({ page }) => {
    await page.goto("/projects/0192e3a0-2222-7000-8000-000000000001");
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await nav.getByRole("link", { name: "Historial" }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole("heading", { name: "Historial", level: 1 })).toBeVisible();
    await expect.poll(() => animationName("main#main > div")(page)).toBe("page-in");
    // El marco (barra lateral) no se anima: solo el contenido.
    expect(
      await page
        .locator("nav[aria-label]")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  });

  test("las listas y rejillas entran de forma escalonada", async ({ page }) => {
    const items = [1, 2, 3, 4].map((n) =>
      summary(project({ id: `0192e3a0-2222-7000-8000-00000000001${n}`, name: `API ${n}` }), 0),
    );
    await mockBff(page, "**/api/projects?*", { body: projectPage(items) });
    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 2, name: "API 4" })).toBeVisible();
    const delays = await page
      .locator("ul.stagger")
      .first()
      .evaluate((ul) =>
        Array.from(ul.children)
          .slice(0, 4)
          .map((li) => ({
            name: getComputedStyle(li).animationName,
            delay: parseFloat(getComputedStyle(li).animationDelay),
          })),
      );
    expect(delays.every((d) => d.name === "rise")).toBe(true);
    expect(delays[1].delay).toBeGreaterThan(delays[0].delay);
    expect(delays[3].delay).toBeGreaterThan(delays[1].delay);
  });

  test("el modal entra y sale con animación", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Confirmar (C-06)" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => getComputedStyle(el).animationName)).toBe("modal-in");
    expect(
      await page
        .locator("[data-state=open]")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBeTruthy();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("los toasts entran, pausan y salen con animación", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "success", exact: true }).click();
    const toast = page.locator("[aria-atomic=true]").first();
    await expect(toast).toBeVisible();
    expect(await toast.evaluate((el) => getComputedStyle(el).animationName)).toBe("toast-in");
    await toast.getByRole("button", { name: "Cerrar aviso" }).click();
    await expect
      .poll(() => toast.evaluate((el) => getComputedStyle(el).animationName).catch(() => "gone"))
      .toMatch(/toast-out|gone/);
    await expect(page.locator("[aria-atomic=true]")).toHaveCount(0);
  });

  test("los menús se abren con animación", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("button", { name: /Ana López/ }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((el) => getComputedStyle(el).animationName)).toBe("menu-in");
  });

  test("las barras de severidad y las gráficas se dibujan al aparecer", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/runs/${RUN_ID}`,
      { body: completedRun() },
      "GET",
    );
    await page.goto(`/projects/${PROJECT_ID}/runs/${RUN_ID}`);
    const bar = page.locator("span.animate-grow-x").first();
    expect(await bar.evaluate((el) => getComputedStyle(el).animationName)).toBe("grow-x");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Ejecuciones por semana" })).toBeVisible();
    const line = page.locator("svg polyline").first();
    expect(await line.evaluate((el) => getComputedStyle(el).animationName)).toBe("draw");
  });

  test("con «reducir movimiento» las animaciones quedan casi instantáneas", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/projects");
    const duration = await page
      .locator("ul.stagger > *")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(duration).toBeLessThan(0.001);
    await page.getByRole("button", { name: /Ana López/ }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    expect(
      await menu.evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
    ).toBeLessThan(0.001);
  });
});

test.describe("esqueletos de carga", () => {
  test("hay un esqueleto para cada tipo de vista y todos se anuncian", async ({ page }) => {
    await page.goto("/design-system");
    for (const label of [
      "Esqueleto de lista",
      "Esqueleto de panel",
      "Esqueleto de tabla",
      "Esqueleto de detalle",
      "Esqueleto de formulario",
      "Esqueleto de estadísticas",
    ]) {
      const region = page.getByRole("status", { name: label });
      await expect(region).toBeAttached();
      await expect(region).toHaveAttribute("aria-busy", "true");
    }
    expect(await animationName(".skeleton")(page)).toBe("shimmer");
  });

  test("Loadable: espera, muestra el esqueleto, hace fundido al contenido y reintenta tras un error", async ({
    page,
  }) => {
    await page.goto("/design-system");
    const group = page.getByRole("group", { name: "Estado de la consulta" });
    await expect(page.getByText("Contenido cargado")).toBeVisible();

    await group.getByRole("button", { name: "loading" }).click();
    await expect(page.getByRole("status", { name: "Cargando la demostración" })).toBeVisible();
    await expect(page.getByText("Contenido cargado")).toHaveCount(0);

    await group.getByRole("button", { name: "ready" }).click();
    await expect(page.getByText("Contenido cargado")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("status", { name: "Cargando la demostración" })).toHaveCount(0);

    await group.getByRole("button", { name: "error" }).click();
    await expect(page.getByText("No pudimos cargar la demostración")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByRole("button", { name: "Reintentar" }).last().click();
    await expect(page.getByText("Contenido cargado")).toBeVisible();
  });

  test("una carga rápida no muestra el esqueleto (sin parpadeo)", async ({ page }) => {
    await page.goto("/design-system");
    const group = page.getByRole("group", { name: "Estado de la consulta" });
    await group.getByRole("button", { name: "loading" }).click();
    await group.getByRole("button", { name: "ready" }).click();
    await expect(page.getByText("Contenido cargado")).toBeVisible();
    await expect(page.getByRole("status", { name: "Cargando la demostración" })).toHaveCount(0);
  });

  test("las estadísticas muestran su esqueleto al cambiar de periodo", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Ejecuciones por semana" })).toBeVisible();
    await page.getByRole("radio", { name: "Últimos 7 días" }).click();
    await expect(page.getByRole("status", { name: "Cargando estadísticas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ejecuciones por día" })).toBeVisible();
  });
});
