import { expect, test } from "./fixtures";
import { mockBff, problem } from "./support/bff";
import { PROJECT_ID } from "./support/projects";

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
    await page.goto(`/projects/${PROJECT_ID}/identities/new`);
    const expected: [string, string[]][] = [
      ["Login automático", ["identity-username", "identity-password", "identity-login-op"]],
      ["Token Bearer", ["identity-token"]],
      ["Cookie de sesión", ["identity-field-name", "identity-value"]],
      ["Cabecera personalizada", ["identity-field-name", "identity-value"]],
    ];
    for (const [kind, ids] of expected) {
      await page.getByRole("radio", { name: new RegExp(kind) }).click();
      await page.getByRole("button", { name: "Guardar identidad" }).click();
      await expect(page.getByLabel("Nombre", { exact: true })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      for (const id of ids)
        await expect(page.locator(`#${id}`)).toHaveAttribute("aria-invalid", "true");
    }
  });

  test("identidad: nombre de cabecera con formato y nombre repetido", async ({ page }) => {
    const calls = await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/identities`,
      { status: 409, body: problem(409, "identity.name_taken") },
      "POST",
    );
    await page.goto(`/projects/${PROJECT_ID}/identities/new`);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Usuario A");
    await page.getByRole("radio", { name: /Cabecera personalizada/ }).click();
    await page.locator("#identity-field-name").fill("X Api Key");
    await page.locator("#identity-value").fill(["valor", "de", "prueba"].join("-"));
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.locator("#identity-field-name")).toHaveAttribute("aria-invalid", "true");
    expect(calls).toHaveLength(0);

    await page.locator("#identity-field-name").fill("X-Api-Key");
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText("Ya hay una identidad con ese nombre. Elige otro.")).toBeVisible();
    expect(calls).toHaveLength(1);
  });

  test("recursos: no se agrega un identificador vacío", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/resources`);
    await page.getByRole("button", { name: "Agregar a Usuario A" }).click();
    await expect(page.getByText("Escribe el identificador del recurso.")).toBeVisible();
  });

  test("los mensajes de validación también salen en inglés", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByRole("button", { name: "Sign in" }).first().click();
    await expect(page.locator("[role=alert]").filter({ hasText: /./ }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Escribe tu");

    await page.goto(`/en/projects/${PROJECT_ID}/identities/new`);
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
    [`/projects/${PROJECT_ID}/policy`, /^Política de acceso/, /^Access policy/],
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
