import { expect, test } from "./fixtures";
import { meBody, mockBff, problem } from "./support/bff";

test.describe("V-09 perfil", () => {
  test("muestra los datos de la cuenta y el rol que devuelve la API", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Perfil", level: 1 })).toBeVisible();
    // Ejemplo `Me` del contrato: analista que aún no acepta los términos.
    await expect(page.getByRole("heading", { name: "Ana López", level: 2 })).toBeVisible();
    await expect(page.getByText("ana@ejemplo.com", { exact: true })).toBeVisible();
    await expect(page.getByText("Analista", { exact: true })).toBeVisible();
    await expect(page.getByText("Aún no aceptas la versión 2026-10-30.")).toBeVisible();
    await expect(page.getByText("El rol lo asigna la plataforma")).toBeVisible();
    await expect(page.getByText("Miembro desde")).toHaveCount(0);
  });

  test("con los términos aceptados muestra la versión y la fecha", async ({ page }) => {
    await mockBff(page, "**/api/me", { body: meBody("admin") }, "GET");
    await page.goto("/profile");
    await expect(page.getByText("Administrador", { exact: true })).toBeVisible();
    await expect(page.getByText(/^Versión 2026-10-30, aceptados el /)).toBeVisible();
  });

  test("mientras carga muestra el esqueleto", async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/me", async (route) => {
      await gate;
      await route.fallback();
    });
    await page.goto("/profile");
    await expect(page.getByRole("status", { name: "Cargando tu perfil" })).toBeVisible();
    release();
    await expect(page.getByText("ana@ejemplo.com", { exact: true })).toBeVisible();
  });

  test("si la API falla muestra el error con su referencia y permite reintentar", async ({
    page,
  }) => {
    await mockBff(page, "**/api/me", { status: 500, body: problem(500, "internal.error") }, "GET");
    await page.goto("/profile");
    await expect(page.getByText("req-e2e-500")).toBeVisible();
    await page.unrouteAll();
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("ana@ejemplo.com", { exact: true })).toBeVisible();
  });

  test("503: servicio no disponible sin detalles internos", async ({ page }) => {
    await mockBff(
      page,
      "**/api/me",
      { status: 503, body: problem(503, "service.unavailable") },
      "GET",
    );
    await page.goto("/profile");
    await expect(page.getByText("503", { exact: true })).toBeVisible();
    await expect(page.getByText("req-e2e-503")).toBeVisible();
  });

  test("el 2FA aparece como próximamente y no ofrece activarlo (V-10)", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("Próximamente. Todavía no está disponible.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Activar 2FA" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Desactivar 2FA" })).toHaveCount(0);
  });

  test("el selector segmentado cambia el idioma desde el perfil", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/profile$/);
    await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
  });
});

test.describe("V-05 segundo factor en el inicio de sesión", () => {
  test("analista: pide 6 dígitos y entra a proyectos", async ({ page }) => {
    await page.goto("/sign-in/two-factor");
    await expect(page.getByRole("heading", { name: "Un paso más" })).toBeVisible();
    const verify = page.getByRole("button", { name: "Verificar" });
    await expect(verify).toBeDisabled();
    await page.keyboard.type("270815");
    await verify.click();
    await expect(page).toHaveURL(/\/projects$/);
  });

  test("permite volver a iniciar sesión", async ({ page }) => {
    await page.goto("/sign-in/two-factor");
    await page.getByRole("link", { name: "Volver a iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe("V-35 acceso de administradores y V-05 variante admin", () => {
  test("valida, no ofrece crear cuenta y sigue siempre con el código", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await expect(page.getByText("ADMIN", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear cuenta" })).toHaveCount(0);

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Escribe tu correo electrónico.")).toBeVisible();

    await page.getByLabel("Correo electrónico").fill("admin@hindama.mx");
    await page.getByLabel("Contraseña", { exact: true }).fill("cualquiera");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in\/two-factor$/);
    await expect(page.getByText(/siempre usan segundo factor/)).toBeVisible();

    await page.keyboard.type("111222");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("enlaza a analistas y a recuperar contraseña", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await page.getByRole("link", { name: "Inicia sesión aquí" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("V-04 no enlaza al acceso de administradores", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator('a[href*="admin"]')).toHaveCount(0);
  });
});

test.describe("V-11 segundo factor obligatorio", () => {
  test("no se puede omitir y al confirmar lleva al panel", async ({ page }) => {
    await page.goto("/setup-two-factor");
    await expect(
      page.getByRole("heading", { name: "Configura el segundo factor para continuar", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Tu rol requiere segundo factor")).toBeVisible();
    await expect(page.getByRole("link", { name: "Cancelar" })).toHaveCount(0);

    await page.getByLabel("Dígito 1 de 6").focus();
    await page.keyboard.type("123456");
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});

for (const scheme of ["dark", "light"] as const) {
  test.describe(`fase 2 · paleta en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const path of [
      "/profile",
      "/profile/two-factor",
      "/setup-two-factor",
      "/sign-in/two-factor",
      "/admin/sign-in",
    ]) {
      test(`${path}: tema correcto y sin desbordamiento`, async ({ page }) => {
        await page.goto(path);
        const result = await page.evaluate(() => ({
          text: getComputedStyle(document.documentElement).getPropertyValue("--text").trim(),
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        }));
        expect(result.text).toBe(scheme === "dark" ? "#f5f2ee" : "#1c1915");
        expect(result.overflow).toBe(false);
      });
    }
  });
}
