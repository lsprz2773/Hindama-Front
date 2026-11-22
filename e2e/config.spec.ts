import { expect, test } from "./fixtures";

const YAML = {
  name: "pedidos-v2.4.yaml",
  mimeType: "application/x-yaml",
  buffer: Buffer.from("openapi: 3.1.0\ninfo:\n  title: Pedidos API\n  version: 2.4.0\npaths: {}\n"),
};

test.describe("V-18 verificación de propiedad", () => {
  test("muestra el código, los dos métodos y los pasos", async ({ page }) => {
    await page.goto("/projects/pagos/verification");
    await expect(
      page.getByRole("heading", { name: "Verifica que la API es tuya", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("hindama-7Q4K-M2XP-9C1L-TR83").first()).toBeVisible();
    await expect(page.getByText("/.well-known/hindama-verificacion.txt")).toBeVisible();

    await page.getByRole("tab", { name: "Registro DNS TXT" }).click();
    await expect(
      page.getByText("_hindama-verificacion.api.pagos-staging.ejemplo.mx"),
    ).toBeVisible();
    await expect(page.getByText("La propagación puede tardar")).toBeVisible();
  });

  test("el primer intento falla con el motivo y el segundo verifica el proyecto", async ({
    page,
  }) => {
    await page.goto("/projects/pagos/verification");
    await expect(page.getByText("Pendiente de verificación").first()).toBeVisible();
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page.getByText("el contenido del archivo es distinto")).toBeVisible();
    await expect(page.getByText("Esperábamos")).toBeVisible();
    await expect(page.getByText("Encontramos")).toBeVisible();

    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(
      page.getByText("Comprobamos que controlas api.pagos-staging.ejemplo.mx"),
    ).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByText("Hecho")).toBeVisible();
    await expect(nav.getByText("Disponible tras verificar")).toHaveCount(0);
  });

  test("copiar el código avisa y deja el texto en el portapapeles", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/projects/pagos/verification");
    await page.getByRole("button", { name: "Copiar código" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "hindama-7Q4K-M2XP-9C1L-TR83",
    );
  });
});

test.describe("V-19 y V-20 contrato y versiones", () => {
  test("sin contrato: valida el archivo y la URL antes de importar", async ({ page }) => {
    await page.goto("/projects/pagos/contract");
    await expect(page.getByText("Aún no hay contrato")).toBeVisible();
    await page.getByRole("button", { name: "Importar y comparar" }).click();
    await expect(page.getByText("Elige un archivo de contrato.")).toBeVisible();

    await page
      .locator("#contract-file")
      .setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await expect(page.getByText("El archivo debe ser .json, .yaml o .yml.")).toBeVisible();

    await page.getByRole("tab", { name: "Desde URL" }).click();
    await page.getByRole("button", { name: "Importar y comparar" }).click();
    await expect(page.getByText("Escribe una URL completa del contrato.")).toBeVisible();
  });

  test("importa un contrato y permite revisar avisos y operaciones", async ({ page }) => {
    await page.goto("/projects/pagos/contract");
    await page.locator("#contract-file").setInputFiles(YAML);
    await expect(page.getByText("pedidos-v2.4.yaml").first()).toBeVisible();
    await page.getByRole("button", { name: "Importar y comparar" }).click();

    await expect(page.getByText("Contrato importado")).toBeVisible();
    await expect(page.getByRole("heading", { name: "3 avisos de esta versión" })).toBeVisible();
    await expect(page.getByText("Un elemento del contrato no se pudo interpretar")).toBeVisible();
    await expect(page.getByText("/paths/~1orders~1{orderId}/get/parameters/2")).toBeVisible();
    await expect(page.getByRole("heading", { name: "42 operaciones" })).toBeVisible();

    await page.getByRole("button", { name: "DELETE", exact: true }).click();
    await expect(page.getByText("Cancela un pedido")).toBeVisible();
    await expect(page.getByText("Crea un pedido")).toHaveCount(0);
    await page.getByRole("button", { name: "Todos" }).click();
    await page.getByRole("searchbox", { name: "Buscar operación" }).fill("factura");
    await expect(page.getByText("Descarga la factura")).toBeVisible();
    await page.getByRole("button", { name: "Detalle de GET /orders/{orderId}/invoice" }).click();
    await expect(page.getByText("bearerAuth (HTTP, JWT)")).toBeVisible();

    // La política deja de estar vacía una vez que hay contrato.
    await page.goto("/projects/pagos/policy");
    await expect(page.getByRole("heading", { name: "Política de acceso", level: 1 })).toBeVisible();
    await expect(page.getByText("Primero importa el contrato")).toHaveCount(0);
  });

  test("política sin contrato pide importarlo primero", async ({ page }) => {
    await page.goto("/projects/pagos/policy");
    await expect(page.getByText("Primero importa el contrato")).toBeVisible();
    await expect(page.getByRole("link", { name: "Importar contrato" })).toHaveAttribute(
      "href",
      /\/projects\/pagos\/contract$/,
    );
  });

  test("versiones: compara contra otra versión y enlaza a la política", async ({ page }) => {
    await page.goto("/projects/pedidos/contract/versions");
    await expect(page.getByRole("heading", { name: "v2.4.0 frente a v2.3.1" })).toBeVisible();
    await expect(
      page.getByText("GET /orders/{orderId}/tracking".replace("GET ", "")),
    ).toBeVisible();
    await expect(page.getByText("Se quitó el esquema de seguridad")).toBeVisible();

    await page.getByRole("button", { name: /v2\.2\.0/ }).click();
    await expect(page.getByRole("heading", { name: "v2.4.0 frente a v2.2.0" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a la política" })).toHaveAttribute(
      "href",
      /\/policy$/,
    );
    await expect(page.getByRole("link", { name: "Volver a la versión actual" })).toBeVisible();
  });
});

test.describe("V-21 y V-22 identidades", () => {
  test("lista las cuentas, sus requisitos y prueba una credencial vencida", async ({ page }) => {
    await page.goto("/projects/pedidos/identities");
    await expect(page.getByRole("heading", { name: "4 identidades" })).toBeVisible();
    await expect(
      page.getByText(
        "Una identidad normal y una con rol de administrador. Te falta la administradora.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Siempre existe")).toBeVisible();
    await expect(page.getByText("Credencial vencida · 401")).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: "Cliente B" });
    await row.getByRole("button", { name: "Probar" }).click();
    await expect(page.getByText("Cliente B: la credencial falló")).toBeVisible();
  });

  test("eliminar una identidad pide confirmación", async ({ page }) => {
    await page.goto("/projects/pedidos/identities");
    await page.getByRole("button", { name: "Eliminar Soporte" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/identidad eliminada/)).toBeVisible();
    await dialog.getByRole("button", { name: "Eliminar identidad" }).click();
    await expect(page.getByRole("heading", { name: "3 identidades" })).toBeVisible();
  });

  test("agregar una identidad valida los campos y aparece en la lista", async ({ page }) => {
    await page.goto("/projects/pedidos/identities");
    await page.getByRole("link", { name: "Agregar identidad" }).click();
    await expect(page).toHaveURL(/\/identities\/new$/);
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText("Escribe el nombre de la identidad.")).toBeVisible();
    await expect(page.getByText("Este campo es obligatorio.")).toBeVisible();

    await page.getByLabel("Nombre", { exact: true }).fill("Administradora");
    await page.getByRole("radio", { name: "Administrador" }).click();
    await page.getByLabel("Token", { exact: true }).fill("tok-9f8e7d6c");
    await page.getByRole("button", { name: "Guardar identidad" }).click();

    await expect(page).toHaveURL(/\/identities$/);
    await expect(page.getByRole("heading", { name: "5 identidades" })).toBeVisible();
    await expect(page.getByText("••••7d6c")).toBeVisible();
    await expect(
      page.getByText("Una identidad normal y una con rol de administrador. Lo cumples."),
    ).toBeVisible();
  });

  test("editar: la credencial queda enmascarada y guardar con prueba fallida pide confirmar", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos/identities/cliente-a");
    await expect(page.getByRole("heading", { name: "Editar identidad", level: 1 })).toBeVisible();
    await expect(
      page.getByText("Termina en ••••a9F2").or(page.getByText("Termina en ••••")),
    ).toBeVisible();

    await page.getByRole("radio", { name: "Token Bearer" }).click();
    await page.getByLabel("Token", { exact: true }).fill("expirado-0000");
    await page.getByRole("button", { name: "Probar ahora" }).click();
    await expect(page.getByText("La API respondió 401 Unauthorized.")).toBeVisible();

    await page.getByRole("button", { name: "Guardar identidad" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("La prueba de la credencial falló")).toBeVisible();
    await dialog.getByRole("button", { name: "Guardar de todos modos" }).click();
    await expect(page).toHaveURL(/\/identities$/);
    await expect(page.getByText("Identidad «Cliente A» guardada")).toBeVisible();
  });
});

test.describe("V-23 recursos por identidad", () => {
  test("muestra los identificadores y cambia de identidad", async ({ page }) => {
    await page.goto("/projects/pedidos/resources");
    await expect(
      page.getByRole("heading", { name: "Recursos por identidad", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "orderId es identificador" }).first(),
    ).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "sku es identificador" })).not.toBeChecked();

    await expect(page.getByText("8f21c0de")).toBeVisible();
    await page.getByRole("radio", { name: /Cliente B/ }).click();
    await expect(page.getByText("1b7e44a0")).toBeVisible();
  });

  test("descubrir, confirmar, agregar a mano y eliminar", async ({ page }) => {
    await page.goto("/projects/pedidos/resources");
    await page.getByRole("button", { name: "Descubrir recursos" }).click();
    await expect(page.getByText("recursos nuevos")).toBeVisible();

    const pending = page.getByRole("listitem").filter({ hasText: "new-cli-" });
    await pending.getByRole("button", { name: "Confirmar" }).click();
    await expect(pending.getByText("Confirmado")).toBeVisible();

    await page.getByRole("textbox", { name: "Identificador" }).fill("zz9900");
    await page.getByRole("button", { name: /Agregar a Cliente A/ }).click();
    await expect(page.getByText("zz9900")).toBeVisible();

    await page.getByRole("button", { name: "Eliminar zz9900" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar recurso" }).click();
    await expect(page.getByText("zz9900")).toHaveCount(0);
  });

  test("identidad sin recursos avisa que Acceso a objetos no podrá probarla", async ({ page }) => {
    await page.goto("/projects/pedidos/resources");
    await page.getByRole("radio", { name: /Soporte/ }).click();
    await expect(page.getByText("Soporte no tiene recursos")).toBeVisible();
  });

  test("sin verificar la propiedad la vista está bloqueada con su motivo", async ({ page }) => {
    await page.goto("/projects/pagos/resources");
    await expect(page.getByText("Disponible tras verificar").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a verificación" })).toBeVisible();
  });
});

test.describe("V-24 política de acceso", () => {
  test("resume el avance y filtra por estado", async ({ page }) => {
    await page.goto("/projects/pedidos/policy");
    await expect(page.getByRole("heading", { name: "38 de 42 confirmadas" })).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Operaciones confirmadas" }),
    ).toHaveAttribute("aria-valuenow", "38");
    await expect(page.getByText("1 regla huérfana")).toBeVisible();

    await page.getByRole("radio", { name: /Propuestas/ }).click();
    await expect(page.getByLabel("Plantilla de PATCH /orders/{orderId}")).toBeVisible();
    await expect(page.getByLabel("Plantilla de POST /orders", { exact: true })).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Buscar ruta" }).fill("zzz");
    await expect(page.getByText("Nada coincide con tus filtros")).toBeVisible();
  });

  test("acción en bloque: aplica la plantilla y confirma las filas elegidas", async ({ page }) => {
    await page.goto("/projects/pedidos/policy");
    await page.getByRole("checkbox", { name: "Seleccionar PATCH /orders/{orderId}" }).check();
    await page
      .getByRole("checkbox", { name: "Seleccionar POST /orders/{orderId}/returns" })
      .check();
    const toolbar = page.getByRole("toolbar", { name: "Acciones en bloque" });
    await expect(toolbar).toContainText("2 seleccionadas");
    await toolbar.getByLabel("Aplicar plantilla").selectOption("admin");
    await toolbar.getByRole("button", { name: "Aplicar y confirmar" }).click();
    await expect(page.getByRole("heading", { name: "40 de 42 confirmadas" })).toBeVisible();
    await page.getByRole("button", { name: "Guardar política" }).click();
    await expect(page.getByText("Política guardada")).toBeVisible();
  });

  test("una plantilla de propiedad sin campo propietario no se puede guardar", async ({ page }) => {
    await page.goto("/projects/pedidos/policy");
    await page.getByLabel("Plantilla de GET /orders", { exact: true }).selectOption("owner");
    await page.getByRole("button", { name: "Guardar política" }).click();
    await expect(page.getByText("Falta el campo propietario")).toBeVisible();
    await page
      .getByLabel("Campo propietario de GET /orders", { exact: true })
      .selectOption("userId");
    await page.getByRole("button", { name: "Guardar política" }).click();
    await expect(page.getByText("Política guardada")).toBeVisible();
  });

  test("confirmar una propuesta sube el contador", async ({ page }) => {
    await page.goto("/projects/pedidos/policy");
    await page.getByRole("button", { name: "Confirmar" }).first().click();
    await expect(page.getByRole("heading", { name: "39 de 42 confirmadas" })).toBeVisible();
  });
});

for (const scheme of ["dark", "light"] as const) {
  test.describe(`fase 4 · paleta en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const path of [
      "/projects/pagos/verification",
      "/projects/pedidos/contract",
      "/projects/pedidos/contract/versions",
      "/projects/pedidos/identities",
      "/projects/pedidos/identities/cliente-a",
      "/projects/pedidos/resources",
      "/projects/pedidos/policy",
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
