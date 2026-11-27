import { expect, test } from "./fixtures";

/** C-01: el menú de usuario muestra la cuenta de `GET /me` y cierra la sesión en el BFF. */
test.describe("C-01 menú de usuario", () => {
  test("muestra el nombre que devuelve la API", async ({ page }) => {
    await page.goto("/projects");
    // Ejemplo `Me` del contrato.
    await expect(page.getByRole("button", { name: /Ana López/ })).toBeVisible();
  });

  test("cerrar sesión llama al BFF con el token anti-CSRF y lleva a iniciar sesión", async ({
    page,
  }) => {
    let csrf: string | undefined;
    await page.route("**/api/auth/sign-out", async (route) => {
      csrf = route.request().headers()["x-csrf-token"];
      await route.fulfill({ status: 204 });
    });
    await page.goto("/projects");
    await page.getByRole("button", { name: /Ana López/ }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(csrf).toBe("e2e-csrf-token");
  });

  test("«Cerrar sesión» de la barra lateral cierra la sesión y no rebota a proyectos", async ({
    page,
  }) => {
    const calls: string[] = [];
    await page.route("**/api/auth/sign-out", async (route) => {
      calls.push(route.request().method());
      await route.fulfill({ status: 204 });
    });
    await page.goto("/projects");
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("button", { name: "Cerrar sesión" })
      .click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(calls).toEqual(["POST"]);
  });

  test.describe("sin sesión", () => {
    test.use({ signedIn: false });
    test("una vista autenticada lleva a iniciar sesión", async ({ page }) => {
      await page.goto("/projects");
      await expect(page).toHaveURL(/\/sign-in$/);
    });
  });
});
