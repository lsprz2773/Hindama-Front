import { expect, test } from "./fixtures";

test.describe("idioma", () => {
  test("el español no lleva prefijo y el inglés va en /en", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Inicia sesión" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    await page.goto("/en/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("el selector cambia de idioma conservando la página y guarda la cookie", async ({
    page,
    context,
  }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: /Idioma de la interfaz/ }).click();
    await page.getByRole("menuitemradio", { name: /English/ }).click();

    await expect(page).toHaveURL(/\/en\/forgot-password$/);
    await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "NEXT_LOCALE")?.value).toBe("en");

    await page.getByRole("button", { name: /Interface language/ }).click();
    await page.getByRole("menuitemradio", { name: /Español/ }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole("heading", { name: "¿Olvidaste tu contraseña?" })).toBeVisible();
  });

  test("el proxy negocia el idioma con Accept-Language", async ({ playwright }) => {
    const api = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    });
    const response = await api.get("/sign-in", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/en/sign-in");
    await api.dispose();
  });

  test("una ruta inexistente muestra la página 404 dentro del idioma activo", async ({ page }) => {
    const response = await page.goto("/en/no-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
  });
});
