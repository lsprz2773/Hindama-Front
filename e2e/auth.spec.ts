import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const STRONG = "Hindama-2026!";

async function fillSignUp(page: Page, password = STRONG, confirm = STRONG) {
  await page.getByLabel("Nombre", { exact: true }).fill("Luis Selvas");
  await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar contraseña").fill(confirm);
}

test.describe("V-04 iniciar sesión", () => {
  test("valida los campos y no revela detalles", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByText("Escribe tu correo electrónico.")).toBeVisible();
    await expect(page.getByText("Escribe tu contraseña.")).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Correo electrónico").fill("no-es-correo");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByText(/formato válido/)).toBeVisible();
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

  test("con datos válidos entra a la lista de proyectos (stub sin API)", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
    await page.getByLabel("Contraseña", { exact: true }).fill("cualquiera");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/projects$/);
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
    await page.goto("/sign-up");
    await fillSignUp(page);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/sign-up\/verify$/);
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
    await page.goto("/forgot-password");

    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText("Escribe tu correo electrónico.")).toBeVisible();
    await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
    await page.getByRole("button", { name: "Enviar código" }).click();

    await expect(page.getByRole("heading", { name: "Escribe el código" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Verificar código" })).toBeDisabled();
    await page.keyboard.type("123456");
    await page.getByRole("button", { name: "Verificar código" }).click();

    await expect(page.getByRole("heading", { name: "Define tu nueva contraseña" })).toBeVisible();
    await expect(page.getByText("Código verificado")).toBeVisible();
    await page.getByLabel("Nueva contraseña").fill("Hindama2026");
    await page.getByLabel("Confirmar contraseña").fill("Hindama2026");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByText("La contraseña aún no cumple todos los requisitos.")).toBeVisible();

    await page.getByLabel("Nueva contraseña").fill(STRONG);
    await page.getByLabel("Confirmar contraseña").fill(STRONG);
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByText("Contraseña cambiada")).toBeVisible();
  });

  test("permite volver al paso 1 para usar otro correo", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Correo electrónico").fill("luis@ejemplo.mx");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await page.getByRole("button", { name: "Usar otro correo" }).click();
    await expect(page.getByRole("heading", { name: "¿Olvidaste tu contraseña?" })).toBeVisible();
  });
});
