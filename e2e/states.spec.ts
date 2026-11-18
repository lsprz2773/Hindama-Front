import { expect, test } from "./fixtures";

test.describe("estados de componentes (toasts, modales, páginas)", () => {
  test("los cinco tipos de toast se muestran con su texto", async ({ page }) => {
    await page.goto("/design-system");
    for (const type of ["success", "error", "warning", "info", "progress"]) {
      await page.getByRole("button", { name: type, exact: true }).click();
      await expect(page.getByText(`Toast ${type}`)).toBeVisible();
      await page
        .locator("[aria-atomic=true]")
        .first()
        .getByRole("button", { name: "Cerrar aviso" })
        .click();
    }
  });

  test("modal con éxito: confirma y se cierra con «Listo»", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Con éxito" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Cambios guardados")).toBeVisible();
    await dialog.getByRole("button", { name: "Listo" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("modal bloqueante: Esc no lo cierra y no ofrece la X", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Bloqueante" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cerrar" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Aceptar y continuar" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("modal de confirmación: mientras envía no se puede cerrar", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Confirmar (C-06)" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Salir sin guardar" }).click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });

  test("estados de página: cargando, vacío, error, permisos, límite y servicio", async ({
    page,
  }) => {
    await page.goto("/design-system");
    const states = page.getByRole("region", { name: "Estados de página (C-13)" });
    await expect(states.getByLabel("Cargando proyectos").first()).toBeAttached();
    await expect(states.getByText("Aún no tienes proyectos")).toBeVisible();
    await expect(states.getByText("Sin hallazgos abiertos")).toBeVisible();
    await expect(states.getByText("Nada coincide con tus filtros")).toBeVisible();
    await expect(states.getByText("No pudimos cargar los proyectos")).toBeVisible();
    await expect(states.getByText(/7F3A-91C2/)).toBeVisible();
    await expect(states.getByText("No tienes permiso para ver esto")).toBeVisible();
    await expect(states.getByText("Demasiadas solicitudes")).toBeVisible();
    await expect(states.getByText("El servicio no está disponible")).toBeVisible();
    for (const link of [
      "Ir a verificación",
      "Importar contrato",
      "Agregar identidad",
      "Ver ejecución",
    ])
      await expect(
        page
          .getByRole("region", { name: "Acción bloqueada con motivo" })
          .getByRole("link", { name: link }),
      ).toBeVisible();
  });

  test("sin red aparece el banner de reconexión y al volver avisa con un toast", async ({
    page,
    context,
  }) => {
    await page.goto("/projects");
    await expect(page.getByText("Sin conexión. Reconectando…")).toHaveCount(0);
    await context.setOffline(true);
    await expect(page.getByText("Sin conexión. Reconectando…")).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText("Sin conexión. Reconectando…")).toHaveCount(0);
    await expect(page.getByText("Conexión recuperada")).toBeVisible();
  });
});

test.describe("dashboard: acciones bloqueadas con su motivo", () => {
  test("un proyecto verificado sin contrato pide importarlo", async ({ page }) => {
    await page.goto("/projects/pagos/verification");
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page.getByText(/Comprobamos que controlas/)).toBeVisible();
    await page.goto("/projects/pagos");
    await expect(page.getByText("Importa un contrato OpenAPI primero.")).toBeVisible();
    await page.getByRole("link", { name: "Importar contrato" }).click();
    await expect(page).toHaveURL(/\/projects\/pagos\/contract$/);
  });

  test("con una ejecución activa el dashboard remite a ella", async ({ page }) => {
    await page.goto("/projects/inventario");
    await expect(page.getByText("Ya hay una ejecución en curso en este proyecto.")).toBeVisible();
    await page.getByRole("link", { name: "Ver ejecución" }).first().click();
    await expect(page).toHaveURL(/\/projects\/inventario\/runs\/current$/);
  });

  test("el módulo sin identidad administradora explica por qué y cómo resolverlo", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos");
    await expect(page.getByText("Sin identidad administradora: agrega una")).toBeVisible();
    await page.getByRole("link", { name: "Agregar identidad" }).first().click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/identities$/);
  });

  test("«Ejecutar» de un módulo abre la configuración con ese módulo elegido", async ({ page }) => {
    await page.goto("/projects/pedidos");
    await page.getByRole("link", { name: "Ejecución de «Autenticación» solicitada" }).click();
    await expect(page).toHaveURL(/\/runs\/new\?module=auth$/);
    await expect(page.getByRole("checkbox", { name: /Autenticación/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Configuración/ })).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Ejecutar 1 módulo" })).toBeEnabled();
  });

  test("«Repetir» desde el dashboard inicia la ejecución", async ({ page }) => {
    await page.goto("/projects/pedidos");
    await page.getByRole("button", { name: /Repetir/ }).click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/runs\/current$/);
  });
});

test.describe("salir con cambios sin guardar", () => {
  test("la política pide confirmar al abandonar con cambios y deja seguir editando", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos/policy");
    await page.getByRole("combobox").first().selectOption({ index: 1 });
    await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();

    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Resumen" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("¿Salir sin guardar?")).toBeVisible();
    await dialog.getByRole("button", { name: "Seguir editando" }).click();
    await expect(page).toHaveURL(/\/policy$/);

    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Resumen" })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Salir sin guardar" }).click();
    await expect(page).toHaveURL(/\/projects\/pedidos$/);
  });

  test("sin cambios se navega sin preguntar", async ({ page }) => {
    await page.goto("/projects/pedidos/settings");
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Resumen" })
      .click();
    await expect(page).toHaveURL(/\/projects\/pedidos$/);
  });

  test("los ajustes con cambios también lo piden", async ({ page }) => {
    await page.goto("/projects/pedidos/settings");
    await page.getByLabel("Nombre").fill("API de Pedidos 2");
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Historial" })
      .click();
    await expect(page.getByRole("dialog").getByText("¿Salir sin guardar?")).toBeVisible();
  });
});
