import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { mockBff, problem } from "./support/bff";

/**
 * Fase 1 · acceso (V-02, V-03, V-04, V-06). Cognito solo se llama desde el BFF; aquí se simulan
 * las rutas `/api/auth/*` del BFF con sus respuestas y códigos, y se comprueba lo que envía la
 * vista. Los handlers del BFF tienen sus propias pruebas unitarias contra Cognito simulado.
 */
test.use({ signedIn: false });

const STRONG = ["Hindama", "2026", "!"].join("-");

async function fillSignUp(page: Page, password = STRONG, confirm = STRONG) {
  await page.getByLabel("Nombre", { exact: true }).fill("  Luis Selvas ");
  await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar contraseña").fill(confirm);
}

const ANY_PASSWORD = "c".repeat(10);

async function signInWith(page: Page, email = "luis@ejemplo.mx", password = ANY_PASSWORD) {
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

test.describe("V-04 iniciar sesión", () => {
  test("valida los campos y no revela detalles", async ({ page }) => {
    const calls = await mockBff(page, "**/api/auth/sign-in", { status: 500 });
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByText("Escribe tu correo electrónico.")).toBeVisible();
    await expect(page.getByText("Escribe tu contraseña.")).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Correo electrónico").fill("no-es-correo");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByText(/formato válido/)).toBeVisible();
    expect(calls).toHaveLength(0);
  });

  test("el botón del ojo muestra y oculta la contraseña", async ({ page }) => {
    await page.goto("/sign-in");
    const field = page.getByLabel("Contraseña", { exact: true });
    await field.fill("secreto");
    await expect(field).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar contraseña" }).click();
    await expect(field).toHaveAttribute("type", "text");
  });

  test("enlaza a recuperar contraseña y crear cuenta", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.goBack();
    await page.getByRole("link", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("envía correo y contraseña al BFF y entra a la pantalla de su rol", async ({ page }) => {
    const calls = await mockBff(page, "**/api/auth/sign-in", {
      body: { csrf_token: "nuevo-token", role: "analyst" },
    });
    await page.goto("/sign-in");
    await signInWith(page, "  luis@ejemplo.mx ", ANY_PASSWORD);
    await expect(page).toHaveURL(/\/projects$/);
    expect(calls).toHaveLength(1);
    expect(calls[0].postDataJSON()).toEqual({
      email: "luis@ejemplo.mx",
      password: ANY_PASSWORD,
    });
    expect(calls[0].headers()["content-type"]).toContain("application/json");
  });

  test("un administrador va a su panel (el rol sale de /me)", async ({ page }) => {
    await mockBff(page, "**/api/auth/sign-in", { body: { csrf_token: "t", role: "admin" } });
    await page.goto("/sign-in");
    await signInWith(page);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("credenciales incorrectas: mensaje genérico (RF-06)", async ({ page }) => {
    await mockBff(page, "**/api/auth/sign-in", {
      status: 401,
      body: problem(401, "auth.invalid_credentials"),
    });
    await page.goto("/sign-in");
    await signInWith(page);
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveText(
      "El correo o la contraseña no son correctos.",
    );
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("cuenta sin confirmar lleva a verificar el correo", async ({ page }) => {
    await mockBff(page, "**/api/auth/sign-in", {
      status: 403,
      body: problem(403, "auth.user_not_confirmed"),
    });
    await page.goto("/sign-in");
    await signInWith(page);
    await expect(page).toHaveURL(/\/sign-up\/verify$/);
    await expect(page.getByText("luis@ejemplo.mx")).toBeVisible();
  });

  test("429: demasiados intentos", async ({ page }) => {
    await mockBff(page, "**/api/auth/sign-in", {
      status: 429,
      body: problem(429, "rate_limit.exceeded"),
      headers: { "Retry-After": "30" },
    });
    await page.goto("/sign-in");
    await signInWith(page);
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveText(
      /Demasiados intentos/,
    );
  });

  test("500 o servicio caído: aviso con reintento, sin detalles internos", async ({ page }) => {
    await mockBff(page, "**/api/auth/sign-in", {
      status: 503,
      body: problem(503, "service.unavailable"),
    });
    await page.goto("/sign-in");
    await signInWith(page);
    await expect(page.getByText("No pudimos iniciar sesión")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  test("el botón queda deshabilitado mientras la petición está en curso", async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let count = 0;
    await page.route("**/api/auth/sign-in", async (route) => {
      count += 1;
      await gate;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ csrf_token: "t", role: "analyst" }),
      });
    });
    await page.goto("/sign-in");
    await signInWith(page);
    const button = page.getByRole("button", { name: "Entrando…" });
    await expect(button).toBeDisabled();
    await button.click({ force: true }).catch(() => {});
    release();
    await expect(page).toHaveURL(/\/projects$/);
    expect(count).toBe(1);
  });
});

test.describe("V-02 y V-03 registro y verificación", () => {
  test("exige todos los campos y la aceptación de los términos", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Escribe tu nombre.")).toBeVisible();
    await expect(page.getByText(/debes aceptar los términos/)).toBeVisible();
  });

  test("las reglas de contraseña se marcan en vivo", async ({ page }) => {
    await page.goto("/sign-up");
    const rules = page.getByRole("list", { name: "Requisitos de la contraseña" });
    await page.getByLabel("Contraseña", { exact: true }).fill("Hindama2026");
    await expect(rules.getByText(/Una mayúscula \(cumplido\)/)).toBeVisible();
    await expect(rules.getByText(/Un símbolo \(pendiente\)/)).toBeVisible();
    await expect(rules.getByText(/12 caracteres o más \(pendiente\)/)).toBeVisible();
  });

  test("rechaza contraseñas débiles o que no coinciden", async ({ page }) => {
    await page.goto("/sign-up");
    await fillSignUp(page, "Hindama2026", "Hindama2026");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("La contraseña aún no cumple todos los requisitos.")).toBeVisible();

    await fillSignUp(page, STRONG, "Otra-clave-2026!");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
  });

  test("registro completo → verificación con código de 6 dígitos → inicio de sesión", async ({
    page,
  }) => {
    const signUp = await mockBff(page, "**/api/auth/sign-up", { status: 204 });
    const confirm = await mockBff(page, "**/api/auth/sign-up/confirm", { status: 204 });
    await page.goto("/sign-up");
    await fillSignUp(page);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/sign-up\/verify$/);
    // Nombre recortado; la casilla de términos no viaja a Cognito.
    expect(signUp[0].postDataJSON()).toEqual({
      name: "Luis Selvas",
      email: "luis@ejemplo.mx",
      password: STRONG,
    });
    await expect(page.getByText("luis@ejemplo.mx")).toBeVisible();
    const verify = page.getByRole("button", { name: "Verificar", exact: true });
    await expect(verify).toBeDisabled();
    await expect(page.getByRole("button", { name: /Reenviar código en/ })).toBeDisabled();

    // El foco avanza solo al escribir los dígitos.
    await page.keyboard.type("481530");
    for (let i = 0; i < 6; i++) {
      await expect(page.getByLabel(`Dígito ${i + 1} de 6`)).toHaveValue("481530"[i]);
    }
    await expect(verify).toBeEnabled();
    await verify.click();
    await expect(page.getByText("Cuenta confirmada")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(confirm[0].postDataJSON()).toEqual({ email: "luis@ejemplo.mx", code: "481530" });
    // El correo pendiente nunca se guarda en el navegador.
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...sessionStorage, ...localStorage }),
    );
    expect(stored).not.toContain("luis@ejemplo.mx");
  });

  test("un correo ya registrado muestra el aviso genérico", async ({ page }) => {
    await mockBff(page, "**/api/auth/sign-up", {
      status: 409,
      body: problem(409, "auth.username_exists"),
    });
    await page.goto("/sign-up");
    await fillSignUp(page);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(
      page.getByRole("status").getByRole("link", { name: "inicia sesión" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("una contraseña rechazada por Cognito se marca junto al campo (422)", async ({ page }) => {
    await mockBff(page, "**/api/auth/sign-up", {
      status: 422,
      body: problem(422, "validation.failed", [
        { field: "password", code: "auth.invalid_password" },
      ]),
    });
    await page.goto("/sign-up");
    await fillSignUp(page);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByText("La contraseña aún no cumple todos los requisitos.")).toBeVisible();
  });

  test("código incorrecto o vencido se marca en el campo del código", async ({ page }) => {
    await page.route("**/api/auth/sign-up/confirm", async (route) => {
      const { code } = route.request().postDataJSON() as { code: string };
      const kind = code === "111111" ? "auth.code_mismatch" : "auth.code_expired";
      await route.fulfill({
        status: 422,
        contentType: "application/problem+json",
        body: JSON.stringify(problem(422, "validation.failed", [{ field: "code", code: kind }])),
      });
    });
    await page.goto("/sign-up/verify");
    await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
    await page.getByLabel("Dígito 1 de 6").focus();
    await page.keyboard.type("111111");
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(
      page.getByText("El código no es correcto. Revísalo e inténtalo de nuevo."),
    ).toBeVisible();

    await page.getByLabel("Dígito 6 de 6").focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace");
    await page.getByLabel("Dígito 1 de 6").focus();
    await page.keyboard.type("222222");
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page.getByText("El código venció. Pide uno nuevo.")).toBeVisible();
  });

  test("al recargar, la verificación pide el correo (no se guardó en el navegador)", async ({
    page,
  }) => {
    await page.goto("/sign-up/verify");
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await page.getByLabel("Dígito 1 de 6").focus();
    await page.keyboard.type("123456");
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page.getByText("Escribe el correo con el que creaste la cuenta.")).toBeVisible();
  });

  test("el código admite pegar los seis dígitos y borrar hacia atrás", async ({ page }) => {
    await page.goto("/sign-up/verify");
    await page.getByLabel("Dígito 1 de 6").focus();
    await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement;
      const data = new DataTransfer();
      data.setData("text", "123456");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
    });
    await expect(page.getByLabel("Dígito 6 de 6")).toHaveValue("6");
    await page.keyboard.press("Backspace");
    await expect(page.getByLabel("Dígito 6 de 6")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Verificar", exact: true })).toBeDisabled();
  });
});

test.describe("V-06 recuperar contraseña", () => {
  test("recorre los tres pasos y vuelve a iniciar sesión", async ({ page }) => {
    const forgot = await mockBff(page, "**/api/auth/password/forgot", { status: 204 });
    const reset = await mockBff(page, "**/api/auth/password/reset", { status: 204 });
    await page.goto("/forgot-password");

    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText("Escribe tu correo electrónico.")).toBeVisible();
    await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
    await page.getByRole("button", { name: "Enviar código" }).click();

    await expect(page.getByRole("heading", { name: "Escribe el código" })).toBeVisible();
    expect(forgot[0].postDataJSON()).toEqual({ email: "luis@ejemplo.mx" });
    await expect(page.getByRole("button", { name: "Verificar código" })).toBeDisabled();
    await page.keyboard.type("123456");
    await page.getByRole("button", { name: "Verificar código" }).click();

    await expect(page.getByRole("heading", { name: "Define tu nueva contraseña" })).toBeVisible();
    await page.getByLabel("Nueva contraseña").fill("Hindama2026");
    await page.getByLabel("Confirmar contraseña").fill("Hindama2026");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByText("La contraseña aún no cumple todos los requisitos.")).toBeVisible();
    expect(reset).toHaveLength(0);

    await page.getByLabel("Nueva contraseña").fill(STRONG);
    await page.getByLabel("Confirmar contraseña").fill(STRONG);
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByText("Contraseña cambiada")).toBeVisible();
    expect(reset[0].postDataJSON()).toEqual({
      email: "luis@ejemplo.mx",
      code: "123456",
      password: STRONG,
    });
  });

  test("un código incorrecto regresa al paso 2 con el motivo", async ({ page }) => {
    await mockBff(page, "**/api/auth/password/forgot", { status: 204 });
    await mockBff(page, "**/api/auth/password/reset", {
      status: 422,
      body: problem(422, "validation.failed", [{ field: "code", code: "auth.code_mismatch" }]),
    });
    await page.goto("/forgot-password");
    await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await page.getByLabel("Dígito 1 de 6").focus();
    await page.keyboard.type("123456");
    await page.getByRole("button", { name: "Verificar código" }).click();
    await page.getByLabel("Nueva contraseña").fill(STRONG);
    await page.getByLabel("Confirmar contraseña").fill(STRONG);
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByRole("heading", { name: "Escribe el código" })).toBeVisible();
    await expect(
      page.getByText("El código no es correcto. Revísalo e inténtalo de nuevo."),
    ).toBeVisible();
  });

  test("429 al pedir el código: aviso junto al correo", async ({ page }) => {
    await mockBff(page, "**/api/auth/password/forgot", {
      status: 429,
      body: problem(429, "rate_limit.exceeded"),
    });
    await page.goto("/forgot-password");
    await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText(/Demasiadas solicitudes/)).toBeVisible();
  });

  test("permite volver al paso 1 para usar otro correo", async ({ page }) => {
    await mockBff(page, "**/api/auth/password/forgot", { status: 204 });
    await page.goto("/forgot-password");
    await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await page.getByRole("button", { name: "Usar otro correo" }).click();
    await expect(page.getByRole("heading", { name: "¿Olvidaste tu contraseña?" })).toBeVisible();
  });
});
