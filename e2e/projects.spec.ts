import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { meBody, mockBff, problem } from "./support/bff";
import {
  NEW_PROJECT_ID,
  newHttpProject,
  page as projectPage,
  project,
  PROJECT_ID,
  summary,
} from "./support/projects";

/** Analista que ya aceptó los términos vigentes (el ejemplo `Me` del contrato aún no). */
async function termsAccepted(page: Page) {
  await mockBff(page, "**/api/me", { body: meBody("analyst") }, "GET");
}

const LIST = "**/api/projects?*";

test.describe("V-13 lista de proyectos", () => {
  test("muestra el resumen y las tarjetas que devuelve listProjects", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Proyectos", level: 1 })).toBeVisible();
    await expect(page.getByText("Hola, Ana.")).toBeVisible();
    // Ejemplo `ProjectPage`: dos proyectos, uno verificado con 5 hallazgos abiertos.
    const summaryRow = page.locator("dl").first();
    await expect(summaryRow).toContainText("Proyectos2");
    await expect(summaryRow).toContainText("Hallazgos abiertos5");
    await expect(summaryRow).toContainText("Pendiente de verificación1");
    await expect(page.getByRole("heading", { level: 2, name: /^API / })).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Verificar propiedad" })).toHaveAttribute(
      "href",
      `/projects/${NEW_PROJECT_ID}/verification`,
    );
    await expect(page.getByRole("link", { name: "API de pedidos" })).toHaveAttribute(
      "href",
      `/projects/${PROJECT_ID}`,
    );
    // La API no busca por texto: la lista no ofrece un buscador.
    await expect(page.getByRole("searchbox")).toHaveCount(0);
  });

  test("el orden lo aplica la API", async ({ page }) => {
    const calls = await mockBff(page, LIST, { body: projectPage([summary(project(), 5)]) });
    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 2, name: "API de pedidos" })).toBeVisible();
    await page.getByLabel("Ordenar por").selectOption("name");
    await expect
      .poll(() => calls.map((c) => new URL(c.url()).searchParams.get("sort")))
      .toContain("name");
    expect(new URL(calls[0].url()).searchParams.get("sort")).toBe("-last_run_at");
  });

  test("pagina con los datos de la API", async ({ page }) => {
    const calls = await mockBff(page, LIST, {
      body: projectPage([summary(project(), 5)], 45, 1, 20),
    });
    await page.goto("/projects");
    await expect(page.getByText("Página 1 de 3")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect
      .poll(() => calls.map((c) => new URL(c.url()).searchParams.get("page")))
      .toContain("2");
  });

  test("sin proyectos muestra el estado vacío con su acción", async ({ page }) => {
    await mockBff(page, LIST, { body: projectPage([]) });
    await page.goto("/projects");
    await expect(page.getByText("Aún no tienes proyectos")).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear proyecto" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
  });

  test("si la API falla muestra la referencia y permite reintentar", async ({ page }) => {
    await mockBff(page, LIST, { status: 500, body: problem(500, "internal.error") });
    await page.goto("/projects");
    await expect(page.getByText("req-e2e-500")).toBeVisible();
    await page.unrouteAll();
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "API de pedidos" })).toBeVisible();
  });

  test("429: espera Retry-After antes de reintentar", async ({ page }) => {
    await mockBff(page, LIST, {
      status: 429,
      body: problem(429, "rate_limit.exceeded"),
      headers: { "Retry-After": "3" },
    });
    await page.goto("/projects");
    await expect(page.getByText(/Podrás reintentar en 0:0\d/)).toBeVisible();
  });

  test("eliminar desde el menú exige el nombre, lo envía y refresca la lista", async ({ page }) => {
    let deleted = false;
    await page.route(LIST, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          projectPage(
            deleted
              ? [summary(project(), 5)]
              : [summary(project(), 5), summary(newHttpProject(), 0)],
          ),
        ),
      }),
    );
    const removals = await mockBff(page, `**/api/projects/${NEW_PROJECT_ID}?*`, {}, "DELETE");
    await page.route(`**/api/projects/${NEW_PROJECT_ID}?*`, async (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      deleted = true;
      await route.fallback();
    });
    await page.goto("/projects");
    await page.getByRole("button", { name: "Más acciones para API interna de inventario" }).click();
    await page.getByRole("menuitem", { name: "Eliminar" }).click();
    const dialog = page.getByRole("alertdialog");
    const confirm = dialog.getByRole("button", { name: "Eliminar proyecto" });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("API interna de inventario");
    await confirm.click();
    await expect(page.getByText("Proyecto «API interna de inventario» eliminado")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "API interna de inventario" }),
    ).toHaveCount(0);
    expect(new URL(removals[0].url()).searchParams.get("confirmation")).toBe(
      "API interna de inventario",
    );
  });

  test("eliminar con una ejecución activa explica por qué no se puede", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}?*`,
      { status: 409, body: problem(409, "project.active_run") },
      "DELETE",
    );
    await page.goto("/projects");
    await page.getByRole("button", { name: "Más acciones para API de pedidos" }).click();
    await page.getByRole("menuitem", { name: "Eliminar" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("textbox").fill("API de pedidos");
    await dialog.getByRole("button", { name: "Eliminar proyecto" }).click();
    await expect(dialog.getByText("Hay una ejecución en curso")).toBeVisible();
  });
});

test.describe("V-14 y V-15 nuevo proyecto", () => {
  test("sin aceptar los términos, el asistente redirige a V-14", async ({ page }) => {
    // Ejemplo `Me` del contrato: `acceptance_required: true`.
    await page.goto("/projects/new");
    await expect(page).toHaveURL(/\/projects\/new\/terms$/);
    await expect(
      page.getByRole("heading", { name: "Antes de tu primer proyecto", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/Versión vigente: 2026-10-30/)).toBeVisible();
  });

  test("V-14: acepta la versión vigente con acceptTerms y lleva al asistente", async ({ page }) => {
    const accepts = await mockBff(page, "**/api/me/terms", { body: meBody("analyst") }, "POST");
    await page.goto("/projects/new/terms");
    const accept = page.getByRole("button", { name: "Aceptar y continuar" });
    await expect(accept).toBeDisabled();
    await expect(page.getByRole("link", { name: "Leer los términos completos" })).toHaveAttribute(
      "href",
      "/terms",
    );
    await page.getByRole("checkbox").click();
    await accept.click();
    await expect(page).toHaveURL(/\/projects\/new$/);
    await expect(page.getByText("Términos aceptados")).toBeVisible();
    expect(accepts).toHaveLength(1);
    expect(accepts[0].postDataJSON()).toEqual({ version: "2026-10-30" });
    expect(accepts[0].headers()["x-csrf-token"]).toBeTruthy();
  });

  test("V-14: si la versión cambió, avisa y pide aceptar otra vez", async ({ page }) => {
    await mockBff(
      page,
      "**/api/me/terms",
      { status: 422, body: problem(422, "terms.outdated_version") },
      "POST",
    );
    await page.goto("/projects/new/terms");
    await page.getByRole("checkbox").click();
    await page.getByRole("button", { name: "Aceptar y continuar" }).click();
    await expect(page.getByText("Se publicó una versión nueva de los términos")).toBeVisible();
    await expect(page.getByRole("button", { name: "Aceptar y continuar" })).toBeDisabled();
  });

  test("V-15: valida nombre y URL, rechaza redes privadas y avisa de HTTP", async ({ page }) => {
    await termsAccepted(page);
    const creates = await mockBff(page, "**/api/projects", {}, "POST");
    await page.goto("/projects/new");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(page.getByText("Escribe el nombre del proyecto.")).toBeVisible();
    await expect(page.getByText("Escribe la URL base de tu API.")).toBeVisible();

    await page.getByRole("textbox", { name: "URL base" }).fill("http://192.168.1.20");
    await page.getByLabel("Nombre", { exact: true }).fill("Mi API");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(page.getByText("No se aceptan direcciones de redes privadas.")).toBeVisible();

    await page.getByRole("textbox", { name: "URL base" }).fill("ftp://api.mi-api.ejemplo.mx");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(page.getByText("Solo se aceptan direcciones HTTP o HTTPS.")).toBeVisible();

    await page.getByRole("textbox", { name: "URL base" }).fill("http://api.mi-api.ejemplo.mx");
    await expect(page.getByText("La URL base usa HTTP sin cifrar")).toBeVisible();
    expect(creates).toHaveLength(0);
  });

  test("V-15: crea el proyecto con createProject, omite pasos y entra a su dashboard", async ({
    page,
  }) => {
    await termsAccepted(page);
    await mockBff(page, `**/api/projects/${NEW_PROJECT_ID}`, { body: newHttpProject() }, "GET");
    const creates: { body: unknown }[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/api/projects") {
        creates.push({ body: r.postDataJSON() });
      }
    });
    await page.goto("/projects/new");
    await page.getByLabel("Nombre", { exact: true }).fill("  API interna de inventario ");
    await page.getByRole("textbox", { name: "URL base" }).fill("http://inventario.ejemplo.mx");
    await page.getByRole("button", { name: "Crear proyecto" }).click();

    // Prism responde con el ejemplo `NewHttpProject`, que trae el aviso `url.no_tls`.
    await expect(page.getByRole("heading", { name: "Carga el contrato" })).toBeVisible();
    expect(creates[0].body).toEqual({
      name: "API interna de inventario",
      description: null,
      base_url: "http://inventario.ejemplo.mx",
    });
    await expect(page.getByText("La URL base usa HTTP sin cifrar")).toBeVisible();
    await page.getByRole("button", { name: "Omitir por ahora" }).click();
    await expect(page.getByRole("heading", { name: "Verifica que la API es tuya" })).toBeVisible();
    await page.getByRole("button", { name: "Omitir por ahora" }).click();
    await page.getByRole("link", { name: "Ir al dashboard" }).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${NEW_PROJECT_ID}$`));
    await expect(
      page.getByRole("heading", { name: "API interna de inventario", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Falta verificar la propiedad").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Prueba completa" })).toBeDisabled();
    await expect(page.getByText("Disponible tras verificar")).toBeVisible();
  });

  test("V-15: un destino que la API no permite se marca en la URL", async ({ page }) => {
    await termsAccepted(page);
    await mockBff(
      page,
      "**/api/projects",
      {
        status: 422,
        body: problem(422, "url.destination_not_allowed", [
          { field: "base_url", code: "url.destination_not_allowed" },
        ]),
      },
      "POST",
    );
    await page.goto("/projects/new");
    await page.getByLabel("Nombre", { exact: true }).fill("Mi API");
    await page.getByRole("textbox", { name: "URL base" }).fill("https://interno.ejemplo.mx");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(page.getByText(/La API no acepta esa dirección/)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "URL base" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("V-15: si la API pide los términos, vuelve a V-14", async ({ page }) => {
    await termsAccepted(page);
    await mockBff(
      page,
      "**/api/projects",
      { status: 403, body: problem(403, "terms.not_accepted") },
      "POST",
    );
    await page.goto("/projects/new");
    await page.getByLabel("Nombre", { exact: true }).fill("Mi API");
    await page.getByRole("textbox", { name: "URL base" }).fill("https://api.ejemplo.mx");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(page).toHaveURL(/\/projects\/new\/terms$/);
  });
});

test.describe("V-16 dashboard del proyecto", () => {
  test("proyecto verificado: hallazgos, severidad, política y módulos", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);
    await expect(page.getByRole("heading", { name: "API de pedidos", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "5 hallazgos abiertos" })).toBeVisible();
    await expect(page.getByText("Uno es crítico.")).toBeVisible();
    await expect(page.getByText("api.tienda-ejemplo.com")).toBeVisible();
    await expect(page.getByRole("link", { name: "Prueba completa" })).toHaveAttribute(
      "href",
      `/projects/${PROJECT_ID}/runs/new`,
    );
    const severity = page.getByRole("region", { name: "Abiertos por severidad" });
    await expect(severity.getByRole("listitem").filter({ hasText: "Crítica" })).toContainText("1");
    await expect(page.getByText("312", { exact: true })).toBeVisible();
    await expect(page.getByText("12:08", { exact: true })).toBeVisible();
    // Requisitos que faltan, con el enlace donde se resuelven.
    await expect(page.getByText("Necesitas al menos 2 identidades con recursos.")).toBeVisible();
    await expect(page.getByText("Sin identidad administradora: agrega una")).toBeVisible();
    await expect(page.getByText("Hay propuestas sin confirmar.")).toBeVisible();
  });

  test("la barra lateral marca el proyecto, el elemento activo y las notas", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}`);
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByText("API de pedidos")).toBeVisible();
    await expect(nav.getByRole("link", { name: "Resumen" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByText("18 op.")).toBeVisible();
  });

  test("proyecto con ejecución en curso muestra el aviso y bloquea otra", async ({ page }) => {
    const running = project({
      last_run: { ...project().last_run, status: "running", end_reason: null, finished_at: null },
    });
    await mockBff(page, `**/api/projects/${PROJECT_ID}`, { body: running }, "GET");
    await page.goto(`/projects/${PROJECT_ID}`);
    await expect(page.getByText("La ejecución sigue en curso")).toBeVisible();
    await expect(page.getByText("Ya hay una ejecución en curso en este proyecto.")).toBeVisible();
  });

  test("un proyecto que no existe o no es tuyo muestra el 404", async ({ page }) => {
    await page.goto("/projects/no-existe");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}`,
      { status: 404, body: problem(404, "resource.not_found") },
      "GET",
    );
    await page.goto(`/projects/${PROJECT_ID}`);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a mis proyectos" })).toBeVisible();
  });

  test("503: servicio no disponible con su referencia", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}`,
      { status: 503, body: problem(503, "service.unavailable") },
      "GET",
    );
    await page.goto(`/projects/${PROJECT_ID}`);
    await expect(page.getByText("req-e2e-503")).toBeVisible();
  });
});

test.describe("V-17 ajustes del proyecto", () => {
  const settings = `/projects/${PROJECT_ID}/settings`;

  test("cambiar el host pide confirmación, envía solo la URL y avisa de la verificación", async ({
    page,
  }) => {
    const lost = project({
      base_url: "https://api.pedidos-v3.ejemplo.mx",
      host: "api.pedidos-v3.ejemplo.mx",
      verification_status: "pending",
      verified_at: null,
      warnings: [
        {
          code: "project.verification_lost",
          message: "Cambió el host.",
          location: null,
        },
      ],
      updated_at: "2026-11-22T10:00:00Z",
    });
    const patches = await mockBff(page, `**/api/projects/${PROJECT_ID}`, { body: lost }, "PATCH");
    await page.goto(settings);
    await expect(
      page.getByRole("heading", { name: "Ajustes del proyecto", level: 1 }),
    ).toBeVisible();
    const save = page.getByRole("button", { name: "Guardar cambios" });
    await expect(save).toBeDisabled();

    await page.getByRole("textbox", { name: "URL base" }).fill("https://api.pedidos-v3.ejemplo.mx");
    await expect(page.getByText("Cambiaste el host", { exact: true })).toBeVisible();
    await expect(page.getByText("Antes:")).toBeVisible();
    await save.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Guardar y perder la verificación" }).click();
    await expect(page.getByText("Cambiaste el host y se perdió la verificación")).toBeVisible();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
    expect(patches[0].postDataJSON()).toEqual({ base_url: "https://api.pedidos-v3.ejemplo.mx" });
  });

  test("solo cambiar la ruta no pide confirmación; descartar restaura", async ({ page }) => {
    await page.goto(settings);
    await page.getByRole("textbox", { name: "URL base" }).fill("https://api.tienda-ejemplo.com/v2");
    await expect(page.getByText("Cambiaste el host", { exact: true })).toHaveCount(0);
    await page.getByLabel("Nombre", { exact: true }).fill("Pedidos v2");
    await page.getByRole("button", { name: "Descartar cambios" }).click();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("API de pedidos");
  });

  test("guardar sin cambiar el host usa updateProject y lo confirma", async ({ page }) => {
    const patches: unknown[] = [];
    page.on("request", (r) => {
      if (r.method() === "PATCH") patches.push(r.postDataJSON());
    });
    await page.goto(settings);
    await page.getByLabel("Nombre", { exact: true }).fill("Pedidos v2");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
    expect(patches).toEqual([{ name: "Pedidos v2" }]);
  });

  test("eliminar el proyecto exige su nombre y vuelve a la lista", async ({ page }) => {
    await page.goto(settings);
    await page.getByRole("button", { name: "Eliminar proyecto" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("textbox").fill("API de pedidos");
    await dialog.getByRole("button", { name: "Eliminar proyecto" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText("Proyecto «API de pedidos» eliminado")).toBeVisible();
  });

  test("el nombre es obligatorio y la URL no admite loopback", async ({ page }) => {
    await page.goto(settings);
    await page.getByLabel("Nombre", { exact: true }).fill("");
    await page.getByRole("textbox", { name: "URL base" }).fill("http://localhost:8080");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Escribe el nombre del proyecto.")).toBeVisible();
    await expect(page.getByText(/direcciones locales/)).toBeVisible();
  });

  test("un destino rechazado por la API se marca en la URL", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}`,
      {
        status: 422,
        body: problem(422, "validation.failed", [
          { field: "base_url", code: "url.destination_not_allowed" },
        ]),
      },
      "PATCH",
    );
    await page.goto(settings);
    await page.getByRole("textbox", { name: "URL base" }).fill("https://api.tienda-ejemplo.com/v9");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText(/La API no acepta esa dirección/)).toBeVisible();
  });
});

for (const scheme of ["dark", "light"] as const) {
  test.describe(`fase 3 · paleta en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const path of [
      "/projects",
      `/projects/${PROJECT_ID}`,
      `/projects/${PROJECT_ID}/settings`,
      "/projects/new/terms",
    ]) {
      test(`${path}: tema correcto y sin desbordamiento`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
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
