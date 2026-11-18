import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function acceptTerms(page: Page) {
  await page.goto("/projects/new/terms");
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Aceptar y continuar" }).click();
  await expect(page).toHaveURL(/\/projects\/new$/);
}

test.describe("V-13 lista de proyectos", () => {
  test("muestra el resumen y las tarjetas con su estado", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Proyectos", level: 1 })).toBeVisible();
    await expect(page.getByText("Hola, Luis. Tienes una ejecución en curso.")).toBeVisible();
    const summary = page.locator("dl").first();
    await expect(summary).toContainText("22");
    await expect(page.getByRole("heading", { level: 2, name: /API de/ })).toHaveCount(3);
    await expect(page.getByText("Ejecución en curso · 58 %")).toBeVisible();
    await expect(page.getByRole("link", { name: "Verificar propiedad" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver progreso" })).toBeVisible();
  });

  test("busca por nombre o URL y muestra «sin resultados» con salida", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("searchbox", { name: "Buscar proyecto" }).fill("inventario.qa");
    await expect(page.getByRole("heading", { level: 2, name: "API de Inventario" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "API de Pedidos" })).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Buscar proyecto" }).fill("zzz");
    await expect(page.getByText("Nada coincide con tus filtros")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "API de Pedidos" })).toBeVisible();
  });

  test("ordena por nombre", async ({ page }) => {
    await page.goto("/projects");
    await page.getByLabel("Ordenar por").selectOption("name");
    const titles = await page.getByRole("heading", { level: 2 }).allInnerTexts();
    const projects = titles.filter((t) => /^(API|Portal)/.test(t));
    expect(projects).toEqual([...projects].sort((a, b) => a.localeCompare(b)));
  });

  test("eliminar desde el menú de la tarjeta exige escribir el nombre", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("button", { name: "Más acciones para Portal de proveedores" }).click();
    await page.getByRole("menuitem", { name: "Eliminar" }).click();
    const dialog = page.getByRole("alertdialog");
    const confirm = dialog.getByRole("button", { name: "Eliminar proyecto" });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("Portal de proveedores");
    await confirm.click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Portal de proveedores" }),
    ).toHaveCount(0);
    await expect(page.getByText("Proyecto «Portal de proveedores» eliminado")).toBeVisible();
  });
});

test.describe("V-14 y V-15 nuevo proyecto", () => {
  test("sin aceptar los términos, el asistente redirige a V-14", async ({ page }) => {
    await page.goto("/projects/new");
    await expect(page).toHaveURL(/\/projects\/new\/terms$/);
    await expect(
      page.getByRole("heading", { name: "Antes de tu primer proyecto", level: 1 }),
    ).toBeVisible();
  });

  test("V-14: el botón se habilita al aceptar y lleva al asistente", async ({ page }) => {
    await page.goto("/projects/new/terms");
    const accept = page.getByRole("button", { name: "Aceptar y continuar" });
    await expect(accept).toBeDisabled();
    await expect(page.getByRole("link", { name: "Leer los términos completos" })).toHaveAttribute(
      "href",
      "/terms",
    );
    await page.getByRole("checkbox").click();
    await expect(accept).toBeEnabled();
    await accept.click();
    await expect(page).toHaveURL(/\/projects\/new$/);
    await expect(page.getByText("Términos aceptados")).toBeVisible();
  });

  test("V-15: valida nombre y URL, rechaza redes privadas y avisa de HTTP", async ({ page }) => {
    await acceptTerms(page);
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(page.getByText("Escribe el nombre del proyecto.")).toBeVisible();
    await expect(page.getByText("Escribe la URL base de tu API.")).toBeVisible();

    await page.getByRole("textbox", { name: "URL base" }).fill("http://192.168.1.20");
    await page.getByLabel("Nombre", { exact: true }).fill("Mi API");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(page.getByText("No se aceptan direcciones de redes privadas.")).toBeVisible();

    await page.getByRole("textbox", { name: "URL base" }).fill("http://api.mi-api.ejemplo.mx");
    await expect(page.getByText("La URL base usa HTTP sin cifrar")).toBeVisible();
    await expect(page.getByText("Persistente", { exact: true })).toBeVisible();
  });

  test("V-15: crea el proyecto, omite pasos y entra a su dashboard", async ({ page }) => {
    await acceptTerms(page);
    await page.getByLabel("Nombre", { exact: true }).fill("API de Clientes");
    await page.getByRole("textbox", { name: "URL base" }).fill("https://api.clientes.ejemplo.mx");
    await expect(page.getByText("15 / 100")).toBeVisible();
    await page.getByRole("button", { name: "Crear proyecto" }).click();

    await expect(page.getByRole("heading", { name: "Carga el contrato" })).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Contrato OpenAPI" }),
    ).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: "Omitir por ahora" }).click();
    await expect(page.getByRole("heading", { name: "Verifica que la API es tuya" })).toBeVisible();
    await page.getByRole("button", { name: "Omitir por ahora" }).click();
    await expect(page.getByRole("heading", { name: "Tu proyecto está listo" })).toBeVisible();
    await page.getByRole("link", { name: "Ir al dashboard" }).click();

    await expect(page).toHaveURL(/\/projects\/api-de-clientes$/);
    await expect(page.getByRole("heading", { name: "API de Clientes", level: 1 })).toBeVisible();
    // Proyecto sin verificar: aviso, acción bloqueada con motivo y recursos bloqueados.
    await expect(page.getByText("Falta verificar la propiedad").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Prueba completa" })).toBeDisabled();
    await expect(page.getByText("Disponible tras verificar")).toBeVisible();

    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 2, name: "API de Clientes" })).toBeVisible();
  });
});

test.describe("V-16 dashboard del proyecto", () => {
  test("proyecto verificado: hallazgos, severidad, política y módulos", async ({ page }) => {
    await page.goto("/projects/pedidos");
    await expect(page.getByRole("heading", { name: "API de Pedidos", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "15 hallazgos abiertos" })).toBeVisible();
    await expect(page.getByText("Uno es crítico y persiste")).toBeVisible();
    await expect(page.getByRole("link", { name: "Prueba completa" })).toHaveAttribute(
      "href",
      "/projects/pedidos/runs/new",
    );

    const severity = page.getByRole("region", { name: "Abiertos por severidad" });
    await expect(severity.getByText("Crítica")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Política de acceso" })).toHaveAttribute(
      "aria-valuenow",
      "90",
    );
    await expect(page.getByText("Sin identidad administradora: agrega una")).toBeVisible();
    await page.getByRole("button", { name: "Repetir última ejecución" }).click();
    await expect(page.getByText("Ejecución programada")).toBeVisible();
  });

  test("la barra lateral marca el proyecto, el elemento activo y las notas", async ({ page }) => {
    await page.goto("/projects/pedidos");
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByText("API de Pedidos")).toBeVisible();
    await expect(nav.getByRole("link", { name: "Resumen" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByText("42 op.")).toBeVisible();
    await expect(nav.getByText("4 sin confirmar")).toBeVisible();
  });

  test("proyecto con ejecución en curso muestra el aviso y su progreso", async ({ page }) => {
    await page.goto("/projects/inventario");
    await expect(page.getByText("La ejecución sigue en curso")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver ejecución" })).toBeVisible();
  });

  test("un proyecto que no existe muestra el 404", async ({ page }) => {
    await page.goto("/projects/no-existe");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });
});

test.describe("V-17 ajustes del proyecto", () => {
  test("cambiar el host pide confirmación y pierde la verificación", async ({ page }) => {
    await page.goto("/projects/pedidos/settings");
    await expect(
      page.getByRole("heading", { name: "Ajustes del proyecto", level: 1 }),
    ).toBeVisible();
    const save = page.getByRole("button", { name: "Guardar cambios" });
    await expect(save).toBeDisabled();

    await page.getByRole("textbox", { name: "URL base" }).fill("https://api.pedidos-v3.ejemplo.mx");
    await expect(page.getByText("Cambiaste el host")).toBeVisible();
    await expect(page.getByText("Antes:")).toBeVisible();
    await save.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Guardar y perder la verificación" }).click();
    await expect(page.getByText("Cambiaste el host y se perdió la verificación")).toBeVisible();
    await expect(page.getByText("Cambios guardados")).toBeVisible();

    await page.goto("/projects");
    await expect(page.getByText("Pendiente de verificación").first()).toBeVisible();
  });

  test("solo cambiar la ruta no pide confirmación; descartar restaura", async ({ page }) => {
    await page.goto("/projects/pedidos/settings");
    await page
      .getByRole("textbox", { name: "URL base" })
      .fill("https://api.pedidos-staging.ejemplo.mx/v2");
    await expect(page.getByText("Cambiaste el host")).toHaveCount(0);
    await page.getByLabel("Nombre", { exact: true }).fill("Pedidos v2");
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("API de Pedidos");
  });

  test("eliminar el proyecto exige su nombre y vuelve a la lista", async ({ page }) => {
    await page.goto("/projects/pagos/settings");
    await page.getByRole("button", { name: "Eliminar proyecto" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("textbox").fill("API de Pagos");
    await dialog.getByRole("button", { name: "Eliminar proyecto" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { level: 2, name: "API de Pagos" })).toHaveCount(0);
  });

  test("el nombre es obligatorio y la URL no admite loopback", async ({ page }) => {
    await page.goto("/projects/pedidos/settings");
    await page.getByLabel("Nombre", { exact: true }).fill("");
    await page.getByRole("textbox", { name: "URL base" }).fill("http://localhost:8080");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Escribe el nombre del proyecto.")).toBeVisible();
    await expect(page.getByText(/direcciones locales/)).toBeVisible();
  });
});

for (const scheme of ["dark", "light"] as const) {
  test.describe(`fase 3 · paleta en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const path of [
      "/projects",
      "/projects/pedidos",
      "/projects/pedidos/settings",
      "/projects/new/terms",
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
