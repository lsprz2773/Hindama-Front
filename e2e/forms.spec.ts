import { expect, test } from "./fixtures";

test.describe("validaciones de formularios", () => {
  test("los códigos de 6 dígitos solo aceptan números y no se envían incompletos", async ({
    page,
  }) => {
    for (const path of ["/sign-up/verify", "/sign-in/two-factor", "/setup-two-factor"]) {
      await page.goto(path);
      const submit = page.getByRole("button", { name: /^(Verificar|Confirmar)$/ }).last();
      await expect(submit).toBeDisabled();
      const first = page.getByRole("textbox", { name: /^(Dígito|Digit) 1/ }).first();
      await first.pressSequentially("a");
      await expect(first).toHaveValue("");
      await expect(submit).toBeDisabled();
    }
  });

  test("acceso de administradores y recuperar contraseña validan el correo", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await page
      .getByRole("button", { name: /Entrar|Continuar|Iniciar/ })
      .first()
      .click();
    await expect(page.getByText("Escribe tu correo electrónico.")).toBeVisible();
    await expect(page.getByText("Escribe tu contraseña.")).toBeVisible();
    await page.getByLabel("Correo electrónico").fill("no-es-correo");
    await page
      .getByRole("button", { name: /Entrar|Continuar|Iniciar/ })
      .first()
      .click();
    await expect(page.getByText(/Escribe un correo con formato válido/)).toBeVisible();

    await page.goto("/forgot-password");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText("Escribe tu correo electrónico.")).toBeVisible();
  });

  test("identidad: cada forma de autenticación exige sus propios campos", async ({ page }) => {
    await page.goto("/projects/pedidos/identities/new");
    const expected: [string, string[]][] = [
      ["Login automático", ["identity-user", "identity-password", "identity-endpoint"]],
      ["Token Bearer", ["identity-token"]],
      ["Cookie de sesión", ["identity-cookieName", "identity-cookieValue"]],
      ["Cabecera personalizada", ["identity-headerName", "identity-headerValue"]],
    ];
    for (const [kind, ids] of expected) {
      await page.getByRole("radio", { name: new RegExp(kind) }).click();
      await page.getByRole("button", { name: "Guardar identidad" }).click();
      await expect(page.getByText("Escribe el nombre de la identidad.")).toBeVisible();
      for (const id of ids)
        await expect(page.locator(`#${id}`)).toHaveAttribute("aria-invalid", "true");
    }
  });

  test("identidad: nombre repetido, endpoint y nombre de cabecera con formato", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos/identities/new");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Cliente A");
    await page.getByRole("radio", { name: /Cabecera personalizada/ }).click();
    await page.locator("#identity-headerName").fill("X Api Key");
    await page.locator("#identity-headerValue").fill("secreto-1234");
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText("Ya hay una identidad con ese nombre. Elige otro.")).toBeVisible();
    await expect(page.getByText(/Usa solo letras, números y los símbolos/)).toBeVisible();

    await page.getByRole("radio", { name: /Login automático/ }).click();
    await page.locator("#identity-user").fill("ana");
    await page.locator("#identity-password").fill("clave-segura");
    await page.locator("#identity-endpoint").fill("login sin ruta");
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText(/Escribe una ruta que empiece con \//)).toBeVisible();
  });

  test("recursos: no se agrega un identificador vacío", async ({ page }) => {
    await page.goto("/projects/pedidos/resources");
    await page.getByRole("button", { name: "Agregar a Cliente A" }).click();
    await expect(page.getByText("Escribe el identificador del recurso.")).toBeVisible();
  });

  test("los mensajes de validación también salen en inglés", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByRole("button", { name: "Sign in" }).first().click();
    await expect(page.locator("[role=alert]").filter({ hasText: /./ }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Escribe tu");

    await page.goto("/en/projects/pedidos/identities/new");
    await page.getByRole("button", { name: "Save identity" }).click();
    await expect(page.getByText("Enter the identity's name.")).toBeVisible();
    await expect(page.getByText("This field is required.").first()).toBeVisible();
  });
});

test.describe("títulos de página por idioma", () => {
  test.use({ role: "admin" });
  const cases: [string, RegExp, RegExp][] = [
    ["/projects/pedidos/history", /^Historial/, /^History/],
    ["/projects/pedidos/findings", /^Hallazgos/, /^Findings/],
    ["/projects/pedidos/runs/new", /^Nueva ejecución/, /^New run/],
    ["/projects/pedidos/policy", /^Política de acceso/, /^Access policy/],
    ["/admin", /^Estadísticas de uso/, /^Usage statistics/],
    ["/admin/audit-log", /^Bitácora de auditoría/, /^Audit log/],
  ];
  for (const [path, es, en] of cases) {
    test(`${path}: el título sigue al idioma`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(es);
      await page.goto(`/en${path}`);
      await expect(page).toHaveTitle(en);
    });
  }
});
