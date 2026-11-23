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

  test("sin segundo factor lo ofrece y lleva a activarlo (V-10)", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("Desactivado. Te recomendamos activarlo.")).toBeVisible();
    await page.getByRole("link", { name: "Activar 2FA" }).click();
    await expect(page).toHaveURL(/\/profile\/two-factor$/);
  });

  test("con segundo factor activo lo muestra y lo desactiva con un código (RF-87)", async ({
    page,
  }) => {
    await mockBff(page, "**/api/me", { body: { ...meBody("analyst"), mfa_enabled: true } }, "GET");
    const calls = await mockBff(page, "**/api/auth/mfa/disable", { status: 204 }, "POST");
    await page.goto("/profile");
    await expect(page.getByText("Activado.")).toBeVisible();
    await page.getByRole("button", { name: "Desactivar 2FA" }).click();
    const dialog = page.getByRole("dialog");
    const submit = dialog.getByRole("button", { name: "Desactivar 2FA" });
    await expect(submit).toBeDisabled();
    await page.keyboard.type("654321");
    await submit.click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].postDataJSON()).toEqual({ code: "654321" });
  });

  test("el administrador no puede desactivar el segundo factor (CU-22 E2)", async ({ page }) => {
    await mockBff(page, "**/api/me", { body: { ...meBody("admin"), mfa_enabled: true } }, "GET");
    await page.goto("/profile");
    await expect(page.getByText("Activado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Desactivar 2FA" })).toHaveCount(0);
  });

  test("eliminar la cuenta (C-14) pide el correo y llama a deleteAccount", async ({ page }) => {
    const calls: string[] = [];
    await page.route(/\/api\/me\?confirmation=/, async (route) => {
      calls.push(`${route.request().method()} ${new URL(route.request().url()).search}`);
      await route.fulfill({ status: 204 });
    });
    await page.goto("/profile");
    await page.getByRole("button", { name: "Eliminar cuenta" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: "Eliminar tu cuenta" })).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Eliminar mi cuenta" });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("ana@ejemplo.com");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect.poll(() => calls).toEqual(["DELETE ?confirmation=ana%40ejemplo.com"]);
  });

  test("eliminar la cuenta con una ejecución activa explica qué hacer", async ({ page }) => {
    await page.route(/\/api\/me\?confirmation=/, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/problem+json",
        body: JSON.stringify(problem(409, "account.active_run")),
      });
    });
    await page.goto("/profile");
    await page.getByRole("button", { name: "Eliminar cuenta" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("textbox").fill("ana@ejemplo.com");
    await dialog.getByRole("button", { name: "Eliminar mi cuenta" }).click();
    await expect(dialog.getByText("Hay una ejecución en curso")).toBeVisible();
  });

  test("un administrador no ve la baja de cuenta", async ({ page }) => {
    await mockBff(page, "**/api/me", { body: meBody("admin") }, "GET");
    await page.goto("/profile");
    await expect(page.getByText("Administrador", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar cuenta" })).toHaveCount(0);
  });

  test("el selector segmentado cambia el idioma desde el perfil", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/profile$/);
    await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
  });
});

const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const SESSION_OK = { csrf_token: "t", role: "analyst", mfa_enabled: true };

test.describe("V-05 segundo factor en el inicio de sesión", () => {
  test("analista: pide 6 dígitos y entra a proyectos", async ({ page }) => {
    const calls = await mockBff(page, "**/api/auth/mfa/challenge", { body: SESSION_OK }, "POST");
    await page.goto("/sign-in/two-factor");
    await expect(page.getByRole("heading", { name: "Un paso más" })).toBeVisible();
    const verify = page.getByRole("button", { name: "Verificar" });
    await expect(verify).toBeDisabled();
    await page.keyboard.type("270815");
    await verify.click();
    await expect(page).toHaveURL(/\/projects$/);
    expect(calls[0].postDataJSON()).toEqual({ code: "270815" });
  });

  test("la contraseña correcta de una cuenta con segundo factor lleva al código", async ({
    page,
  }) => {
    await mockBff(page, "**/api/auth/sign-in", { body: { mfa_required: true } }, "POST");
    await page.goto("/sign-in");
    await page.getByLabel("Correo electrónico").fill("ana@ejemplo.mx");
    await page.getByLabel("Contraseña", { exact: true }).fill("cualquiera");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/sign-in\/two-factor$/);
  });

  test("un código incorrecto lo avisa y deja reintentar", async ({ page }) => {
    await mockBff(
      page,
      "**/api/auth/mfa/challenge",
      {
        status: 422,
        body: problem(422, "validation.failed", [{ field: "code", code: "auth.code_mismatch" }]),
      },
      "POST",
    );
    await page.goto("/sign-in/two-factor");
    await page.keyboard.type("000000");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page.getByText("El código no es correcto.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in\/two-factor$/);
  });

  test("si pasaron más de 3 minutos pide volver a iniciar sesión", async ({ page }) => {
    await mockBff(
      page,
      "**/api/auth/mfa/challenge",
      { status: 401, body: problem(401, "auth.mfa_expired") },
      "POST",
    );
    await page.goto("/sign-in/two-factor");
    await page.keyboard.type("123456");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page.getByText(/Pasaron más de 3 minutos/)).toBeVisible();
  });

  test("permite volver a iniciar sesión", async ({ page }) => {
    await page.goto("/sign-in/two-factor");
    await page.getByRole("link", { name: "Volver a iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe("V-35 acceso de administradores y V-05 variante admin", () => {
  test("valida, no ofrece crear cuenta y, con segundo factor, sigue con el código", async ({
    page,
  }) => {
    await mockBff(page, "**/api/auth/sign-in", { body: { mfa_required: true } }, "POST");
    const challenge = await mockBff(
      page,
      "**/api/auth/mfa/challenge",
      { body: { csrf_token: "t", role: "admin", mfa_enabled: true } },
      "POST",
    );
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
    expect(challenge).toHaveLength(1);
  });

  test("un administrador sin segundo factor va a activarlo (RF-86)", async ({ page }) => {
    await mockBff(
      page,
      "**/api/auth/sign-in",
      { body: { csrf_token: "t", role: "admin", mfa_enabled: false } },
      "POST",
    );
    await page.goto("/admin/sign-in");
    await page.getByLabel("Correo electrónico").fill("admin@hindama.mx");
    await page.getByLabel("Contraseña", { exact: true }).fill("cualquiera");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/setup-two-factor$/);
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

  test("el panel de un administrador sin segundo factor lo lleva a activarlo", async ({ page }) => {
    await mockBff(page, "**/api/me", { body: meBody("admin") }, "GET");
    await mockBff(
      page,
      "**/api/admin/stats*",
      { status: 403, body: problem(403, "auth.mfa_required") },
      "GET",
    );
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Falta tu segundo factor" })).toBeVisible();
    await page.getByRole("link", { name: "Activar el segundo factor" }).click();
    await expect(page).toHaveURL(/\/setup-two-factor$/);
  });
});

test.describe("V-10 activar el segundo factor", () => {
  test("muestra el QR y la clave reales y, al confirmar, vuelve al perfil", async ({ page }) => {
    await mockBff(page, "**/api/auth/mfa/setup", { body: { secret: SECRET } }, "POST");
    const verify = await mockBff(page, "**/api/auth/mfa/verify", { status: 204 }, "POST");
    await page.goto("/profile/two-factor");
    await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();
    await expect(page.getByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeVisible();

    const confirm = page.getByRole("button", { name: "Confirmar" });
    await page.getByLabel("Dígito 1 de 6").focus();
    await page.keyboard.type("123456");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page).toHaveURL(/\/profile$/);
    expect(verify[0].postDataJSON()).toEqual({ code: "123456" });
  });

  test("un código incorrecto lo avisa", async ({ page }) => {
    await mockBff(page, "**/api/auth/mfa/setup", { body: { secret: SECRET } }, "POST");
    await mockBff(
      page,
      "**/api/auth/mfa/verify",
      {
        status: 422,
        body: problem(422, "validation.failed", [{ field: "code", code: "auth.code_mismatch" }]),
      },
      "POST",
    );
    await page.goto("/profile/two-factor");
    await page.getByLabel("Dígito 1 de 6").focus();
    await page.keyboard.type("000000");
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("El código no es correcto.")).toBeVisible();
    await expect(page).toHaveURL(/\/profile\/two-factor$/);
  });

  test("si Cognito no entrega la clave ofrece reintentar", async ({ page }) => {
    await mockBff(
      page,
      "**/api/auth/mfa/setup",
      { status: 503, body: problem(503, "service.unavailable") },
      "POST",
    );
    await page.goto("/profile/two-factor");
    await expect(page.getByText("No pudimos generar la clave.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });
});

test.describe("V-11 segundo factor obligatorio", () => {
  test("no se puede omitir y al confirmar lleva al panel", async ({ page }) => {
    await mockBff(page, "**/api/auth/mfa/setup", { body: { secret: SECRET } }, "POST");
    await mockBff(page, "**/api/auth/mfa/verify", { status: 204 }, "POST");
    await page.goto("/setup-two-factor");
    await expect(
      page.getByRole("heading", { name: "Configura el segundo factor para continuar", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Tu rol requiere segundo factor")).toBeVisible();
    await expect(page.getByRole("link", { name: "Cancelar" })).toHaveCount(0);

    await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();
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
