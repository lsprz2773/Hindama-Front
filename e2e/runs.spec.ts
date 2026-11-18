import { expect, test } from "./fixtures";

test.describe("V-25 configurar una ejecución", () => {
  test("arranca con los módulos por omisión y bloquea el de administrador con su motivo", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos/runs/new");
    await expect(page.getByRole("heading", { name: "Nueva ejecución", level: 1 })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Autenticación/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Acceso a objetos/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Propiedades/ })).not.toBeChecked();
    const functions = page.getByRole("checkbox", { name: /Acceso a funciones/ });
    await expect(functions).toBeDisabled();
    await expect(page.getByText("Requiere una identidad administradora").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Agregar identidad" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ejecutar 3 módulos" })).toBeEnabled();
  });

  test("un módulo de riesgo exige confirmación antes de poder ejecutar", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/new");
    await page.getByRole("checkbox", { name: /Propiedades/ }).check();
    await expect(
      page.getByRole("heading", { name: /Activaste módulos que modifican datos/ }),
    ).toBeVisible();
    const run = page.getByRole("button", { name: "Ejecutar 4 módulos" });
    await expect(run).toBeDisabled();
    await expect(
      page.getByText("Confirma cada módulo de riesgo para poder ejecutar."),
    ).toBeVisible();

    await page.getByRole("checkbox", { name: /Confirmar Propiedades/ }).check();
    await expect(run).toBeEnabled();

    // Desmarcar el módulo retira la advertencia y su confirmación.
    await page.getByRole("checkbox", { name: /^Propiedades/ }).uncheck();
    await expect(page.getByRole("heading", { name: /Activaste módulos/ })).toHaveCount(0);
  });

  test("un límite fuera de rango lo avisa y bloquea la ejecución", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/new");
    const rps = page.getByLabel("Peticiones por segundo");
    await rps.fill("99");
    await expect(page.getByText("Escribe un número entero entre 1 y 20.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ejecutar 3 módulos" })).toBeDisabled();
    await rps.fill("8");
    await expect(page.getByRole("button", { name: "Ejecutar 3 módulos" })).toBeEnabled();
  });

  test("ejecutar abre la vista en curso y deja el proyecto con una ejecución activa", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos/runs/new");
    await page.getByRole("button", { name: "Ejecutar 3 módulos" }).click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/runs\/current$/);
    await expect(page.getByRole("heading", { name: "Ejecución en curso", level: 1 })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Avance de la ejecución" })).toBeVisible();

    // Con una ejecución activa no se puede configurar otra.
    await page.goto("/projects/pedidos/runs/new");
    await expect(page.getByText("Ya hay una ejecución en curso.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver la ejecución" })).toBeVisible();
  });

  test("un proyecto sin verificar explica por qué no se puede ejecutar", async ({ page }) => {
    await page.goto("/projects/pagos/runs/new");
    await expect(
      page.getByText("Verifica la URL base del proyecto antes de ejecutar."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Ir a verificación" }).click();
    await expect(page).toHaveURL(/\/projects\/pagos\/verification$/);
  });
});

test.describe("V-26 ejecución en curso", () => {
  test("muestra el avance en vivo y los módulos", async ({ page }) => {
    await page.goto("/projects/inventario/runs/current");
    await expect(page.getByRole("heading", { name: "Ejecución en curso", level: 1 })).toBeVisible();
    await expect(page.getByText("En vivo")).toBeVisible();
    const bar = page.getByRole("progressbar", { name: "Avance de la ejecución" });
    const first = Number(await bar.getAttribute("aria-valuenow"));
    await expect
      .poll(async () => Number(await bar.getAttribute("aria-valuenow")), { timeout: 10_000 })
      .toBeGreaterThan(first);
    await expect(page.getByRole("heading", { name: "Módulos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Avisos" })).toBeVisible();
  });

  test("cancelar pide confirmación y deja el proyecto sin ejecución activa", async ({ page }) => {
    await page.goto("/projects/inventario/runs/current");
    await page.getByRole("button", { name: "Cancelar ejecución" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("¿Cancelar la ejecución n.º 1?")).toBeVisible();

    await dialog.getByRole("button", { name: "Seguir ejecutando" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Cancelar ejecución" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar ejecución" }).click();
    await expect(page).toHaveURL(/\/projects\/inventario$/);
    await expect(page.getByText("Ejecución n.º 1 cancelada")).toBeVisible();

    await page.goto("/projects/inventario/runs/current");
    await expect(page.getByText("No hay una ejecución en curso")).toBeVisible();
  });

  test("sin ejecución activa ofrece iniciar una nueva", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/current");
    await expect(page.getByText("No hay una ejecución en curso")).toBeVisible();
    await page.getByRole("link", { name: "Nueva ejecución" }).click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/runs\/new$/);
  });
});

test.describe("V-27 resultados", () => {
  test("resume la ejecución con la comparación, la severidad y los avisos", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3");
    await expect(page.getByRole("heading", { name: "Ejecución n.º 3", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "15 hallazgos" })).toBeVisible();
    await expect(page.getByText("Fin: normal")).toBeVisible();
    await expect(page.getByText("Contrato v2.4.0")).toBeVisible();
    await expect(page.getByText("Repetición de la ejecución n.º 2")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frente a la ejecución n.º 2" })).toBeVisible();
    await expect(page.getByText("Cliente B tenía la credencial vencida")).toBeVisible();
    await expect(page.getByText("Acceso a funciones no se ejecutó")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /recursos quedaron sin eliminar/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Más graves" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("las pestañas llevan a la matriz y a los hallazgos", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3");
    await page.getByRole("tab", { name: "Matriz de acceso" }).click();
    await expect(page).toHaveURL(/\/runs\/3\/matrix$/);
    await page.getByRole("tab", { name: /Hallazgos \(15\)/ }).click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/findings$/);
  });

  test("exportar a Excel avisa con un toast", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3");
    await page.getByRole("button", { name: "Exportar a Excel" }).click();
    await expect(page.getByText("Exportación lista")).toBeVisible();
  });

  test("volver a probar inicia una ejecución y abre el progreso", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3");
    await page.getByRole("button", { name: "Volver a probar" }).click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/runs\/current$/);
  });

  test("una ejecución inexistente responde 404 y un proyecto sin ejecuciones lo explica", async ({
    page,
  }) => {
    await page.goto("/projects/pedidos/runs/99");
    await expect(page.getByRole("heading", { name: /no existe|no encontr/i })).toBeVisible();
    await page.goto("/projects/pagos/runs/1");
    await expect(page.getByText("Aún no hay ejecuciones")).toBeVisible();
  });

  test("una ejecución terminada en la sesión se puede consultar", async ({ page }) => {
    await page.goto("/projects/inventario/runs/current");
    await expect(page.getByRole("link", { name: "Ver resultados" })).toBeVisible({
      timeout: 45_000,
    });
    await page.getByRole("link", { name: "Ver resultados" }).click();
    await expect(page.getByRole("heading", { name: "Ejecución n.º 1", level: 1 })).toBeVisible();
    await expect(page.getByText("Primera ejecución")).toBeVisible();
  });
});

test.describe("V-28 matriz de acceso", () => {
  test("muestra las operaciones por identidad con la leyenda", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3/matrix");
    await expect(page.getByRole("heading", { name: "Matriz de acceso", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /10 operaciones · 4 identidades · 4 discrepancias/ }),
    ).toBeVisible();
    await expect(page.getByText("Discrepancia: abre el hallazgo")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Cliente A/ })).toBeVisible();
    await expect(page.getByText("Credencial vencida").first()).toBeVisible();
  });

  test("«Solo discrepancias» deja únicamente las filas con discrepancia", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3/matrix");
    const toggle = page.getByRole("switch", { name: "Solo discrepancias" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("heading", { name: /4 operaciones · 4 identidades · 4 discrepancias/ }),
    ).toBeVisible();
    await expect(page.getByText("/health")).toHaveCount(0);
  });

  test("una discrepancia abre su hallazgo", async ({ page }) => {
    await page.goto("/projects/pedidos/runs/3/matrix");
    await page
      .getByRole("link", { name: /Soporte: 200 · Discrepancia/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/projects\/pedidos\/findings\/f0\d$/);
  });
});

test.describe("V-29 hallazgos", () => {
  test("por omisión lista los abiertos ordenados por severidad", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await expect(page.getByRole("heading", { name: "Hallazgos", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "9 hallazgos abiertos" })).toBeVisible();
    await expect(page.getByText("Mostrando 9 de 15")).toBeVisible();
    const first = page
      .getByRole("list")
      .filter({ hasText: "Un usuario puede leer pedidos" })
      .first();
    await expect(first).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Quitar filtro «Estado: abiertos»/ }),
    ).toBeVisible();
  });

  test("filtra por severidad y por módulo y limpia los filtros", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page.getByLabel("Severidad").selectOption("high");
    await expect(page.getByRole("heading", { name: "3 hallazgos abiertos" })).toBeVisible();
    await page.getByLabel("Módulo").selectOption("auth");
    await expect(page.getByRole("heading", { name: "1 hallazgo abierto" })).toBeVisible();
    await expect(page.getByText("El token vencido sigue siendo aceptado")).toBeVisible();

    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.getByRole("heading", { name: "15 hallazgos" })).toBeVisible();
  });

  test("el motivo de descarte muestra los descartados", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page.getByLabel("Motivo de descarte").selectOption("false_positive");
    await expect(page.locator("#f-est")).toHaveValue("acceptedRisk");
    await expect(page.getByText("Falta la cabecera X-Content-Type-Options")).toBeVisible();
    await expect(page.getByText("El servidor anuncia su versión")).toHaveCount(0);
  });

  test("sin coincidencias ofrece limpiar", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page.getByLabel("Severidad").selectOption("critical");
    await page.getByLabel("Módulo").selectOption("auth");
    await expect(page.getByText("Nada coincide con tus filtros")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros", exact: true }).last().click();
    await expect(page.getByText("Nada coincide con tus filtros")).toHaveCount(0);
  });

  test("exportar incluye solo los filtrados", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page.getByLabel("Severidad").selectOption("high");
    await page.getByRole("button", { name: "Exportar a Excel" }).click();
    await expect(page.getByText("Se exportaron 3 hallazgos.")).toBeVisible();
  });

  test("un proyecto sin hallazgos invita a ejecutar", async ({ page }) => {
    await page.goto("/projects/pagos/findings");
    await expect(page.getByText("Aún no hay hallazgos")).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar a Excel" })).toBeDisabled();
  });

  test("abrir un hallazgo lleva a su detalle", async ({ page }) => {
    await page.goto("/projects/pedidos/findings");
    await page
      .getByRole("link", { name: "Un usuario puede leer pedidos de otro usuario", exact: true })
      .click();
    await expect(page).toHaveURL(/\/findings\/f01$/);
  });
});

test.describe("V-30 detalle de hallazgo", () => {
  test("muestra esperado, observado, evidencia, corrección e historial", async ({ page }) => {
    await page.goto("/projects/pedidos/findings/f01");
    await expect(
      page.getByRole("heading", {
        name: "Un usuario puede leer pedidos de otro usuario",
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByText("Severidad crítica")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Esperado según la política «Solo propietario»/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Observado como Soporte" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evidencia de la ejecución 3" })).toBeVisible();
    await expect(page.getByText("Authorization: Bearer ••••••••••a9F2")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cómo corregirlo" })).toBeVisible();
    await expect(page.getByText("Detectado por primera vez en la ejecución 1")).toBeVisible();
    await expect(page.getByRole("link", { name: /CWE-639/ })).toHaveAttribute(
      "href",
      "https://cwe.mitre.org/data/definitions/639.html",
    );
  });

  test("copiar como curl deja el comando en el portapapeles", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/projects/pedidos/findings/f01");
    await page.getByRole("button", { name: "Copiar como curl" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("curl https://");
  });

  test("aceptar el riesgo, verlo descartado y revertirlo", async ({ page }) => {
    await page.goto("/projects/pedidos/findings/f01");
    await page.getByRole("button", { name: "Aceptar el riesgo" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /Falso positivo/ }).check();
    await dialog.getByRole("textbox").fill("El balanceador responde así a propósito.");
    await dialog.getByRole("button", { name: "Descartar hallazgo" }).click();
    await expect(page.getByText("Hallazgo descartado como falso positivo")).toBeVisible();
    await expect(page.getByText("Descartado como falso positivo", { exact: true })).toBeVisible();
    await expect(page.getByText("El balanceador responde así a propósito.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceptar el riesgo" })).toHaveCount(0);

    // Ya no cuenta entre los abiertos de la lista.
    await page.goto("/projects/pedidos/findings");
    await expect(page.getByRole("heading", { name: "8 hallazgos abiertos" })).toBeVisible();

    await page.goto("/projects/pedidos/findings/f01");
    await page.getByRole("button", { name: "Revertir" }).click();
    await expect(page.getByText("El hallazgo volvió a «Persistente»")).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceptar el riesgo" })).toBeVisible();
  });

  test("un hallazgo que no existe responde 404", async ({ page }) => {
    await page.goto("/projects/pedidos/findings/f99");
    await expect(page.getByText("Hallazgo no encontrado").first()).toBeVisible();
  });
});
