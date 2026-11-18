import { expect, test } from "./fixtures";

test.describe("área pública", () => {
  test("V-01 lleva a crear cuenta, iniciar sesión y a los textos legales", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Encuentra las fallas");
    await page.getByRole("link", { name: "Crear cuenta" }).first().click();
    await expect(page).toHaveURL(/\/sign-up$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Términos de uso" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await page.goBack();
    await page.getByRole("link", { name: "Aviso de privacidad" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test("V-01 'Ver qué prueba' baja a los siete módulos", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ver qué prueba" }).click();
    await expect(page).toHaveURL(/#modules$/);
    await expect(page.getByRole("heading", { name: "Siete módulos de prueba" })).toBeInViewport();
  });

  test("V-07 y V-08 resaltan la sección que se está leyendo", async ({ page }) => {
    await page.goto("/terms");
    const toc = page.getByRole("navigation", { name: "Contenido" });
    await expect(toc.getByRole("link", { name: /Objeto del servicio/ })).toHaveAttribute(
      "aria-current",
      "location",
    );
    await toc.getByRole("link", { name: /Suspensión/ }).click();
    await expect(toc.getByRole("link", { name: /Suspensión/ })).toHaveAttribute(
      "aria-current",
      "location",
    );

    await page.goto("/privacy");
    await expect(page.getByRole("list", { name: "Plazos de conservación" })).toContainText(
      "6 meses",
    );
  });

  test("el enlace 'Saltar al contenido' lleva al contenido principal", async ({ page }) => {
    await page.goto("/sign-in");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  });
});
