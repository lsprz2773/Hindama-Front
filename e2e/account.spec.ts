import { expect, test } from "./fixtures";

test.describe("V-09 perfil", () => {
  test("muestra los datos de la cuenta y el rol", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Perfil", level: 1 })).toBeVisible();
    await expect(page.getByText("luis@ejemplo.mx", { exact: true })).toBeVisible();
    await expect(page.getByText("Analista", { exact: true })).toBeVisible();
    await expect(page.getByText("El rol lo asigna la plataforma")).toBeVisible();
  });

  test("cambiar contraseña (C-17): valida, muestra reglas y confirma", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible();

    await dialog.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(dialog.getByText("Escribe tu contraseña actual.")).toBeVisible();

    await dialog.getByLabel("Contraseña actual").fill("Vieja-clave-2026!");
    await dialog.getByLabel("Contraseña nueva", { exact: true }).fill("Hindama2026");
    await expect(dialog.getByText(/Un símbolo \(pendiente\)/)).toBeVisible();
    await dialog.getByLabel("Confirmar contraseña nueva").fill("Otra");
    await expect(dialog.getByText("Las contraseñas no coinciden.")).toBeVisible();

    await dialog.getByLabel("Contraseña nueva", { exact: true }).fill("Hindama-2027!");
    await dialog.getByLabel("Confirmar contraseña nueva").fill("Hindama-2027!");
    await dialog.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(dialog.getByRole("heading", { name: "Contraseña actualizada" })).toBeVisible();
    await dialog.getByRole("button", { name: "Listo" }).click();
    await expect(dialog).toBeHidden();
  });

  test("activar y desactivar el 2FA (V-10) cambia el estado del perfil", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("Desactivado. Te recomendamos activarlo.")).toBeVisible();
    await page.getByRole("link", { name: "Activar 2FA" }).click();
    await expect(page).toHaveURL(/\/profile\/two-factor$/);
    await expect(
      page.getByRole("heading", { name: "Activa el segundo factor", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();
    await expect(page.getByText("JBSW Y3DP EHPK 3PXP")).toBeVisible();

    const confirm = page.getByRole("button", { name: "Confirmar" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Dígito 1 de 6").focus();
    await page.keyboard.type("123456");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText("Activado.")).toBeVisible();

    await page.getByRole("button", { name: "Desactivar 2FA" }).click();
    const dialog = page.getByRole("dialog");
    const submit = dialog.getByRole("button", { name: "Desactivar 2FA" });
    await expect(submit).toBeDisabled();
    await page.keyboard.type("654321");
    await submit.click();
    await expect(page.getByText("Desactivado. Te recomendamos activarlo.")).toBeVisible();
  });

  test("el selector segmentado cambia el idioma desde el perfil", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/profile$/);
    await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
  });

  test("eliminar cuenta (C-14): exige el correo y vuelve al inicio con aviso", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Se borra")).toBeVisible();
    await expect(dialog.getByText("Se conserva")).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Eliminar mi cuenta" });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("otro@ejemplo.mx");
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("luis@ejemplo.mx");
    await confirm.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("status").filter({ hasText: "Tu cuenta se eliminó" }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tu cuenta se eliminó" })).toHaveCount(0);
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
