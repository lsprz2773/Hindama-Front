import { expect, test } from "./fixtures";
import { mockBff, problem } from "./support/bff";
import { project, PROJECT_ID } from "./support/projects";

/** Ejemplo `PendingVerification` del contrato. */
const PENDING_VERIFICATION = {
  status: "pending",
  host: "api.tienda-ejemplo.com",
  code: "hindama-verificacion=8f3a1c9e2b7d4f60a5e1c3b9d7f2a4e6",
  method: null,
  verified_at: null,
  file: {
    url: "https://api.tienda-ejemplo.com/.well-known/hindama-verificacion.txt",
    content: "hindama-verificacion=8f3a1c9e2b7d4f60a5e1c3b9d7f2a4e6",
  },
  dns: {
    name: "_hindama-verificacion.api.tienda-ejemplo.com",
    type: "TXT",
    value: "hindama-verificacion=8f3a1c9e2b7d4f60a5e1c3b9d7f2a4e6",
  },
};

/** Ejemplo `ContractVersion` del contrato. */
const CONTRACT_V2 = {
  id: "0192e3a0-3333-7000-8000-000000000002",
  number: 2,
  source: "url",
  openapi_version: "3.0.3",
  operation_count: 18,
  imported_at: "2026-11-03T10:05:00Z",
  source_url: "https://raw.githubusercontent.com/tienda-ejemplo/api/main/openapi.yaml",
  file_name: null,
  format: "yaml",
  api_title: "API de pedidos",
  sha256: "9b74c9897bac770ffc029102a200c5de0a1b2c3d4e5f60718293a4b5c6d7e8f9",
  is_current: true,
  warnings: [],
  changes: null,
};

/** El proyecto del ejemplo, aún sin verificar. */
const newPending = () => project({ verification_status: "pending", verified_at: null });

const YAML = {
  name: "pedidos-v2.4.yaml",
  mimeType: "application/x-yaml",
  buffer: Buffer.from("openapi: 3.1.0\ninfo:\n  title: Pedidos API\n  version: 2.4.0\npaths: {}\n"),
};

test.describe("V-18 verificación de propiedad", () => {
  const VERIFY = `**/api/projects/${PROJECT_ID}/verification`;
  // Ejemplo `PendingVerification` del contrato.
  const CODE = "hindama-verificacion=8f3a1c9e2b7d4f60a5e1c3b9d7f2a4e6";

  test("muestra el código, los dos métodos y los pasos que da getVerification", async ({
    page,
  }) => {
    await page.goto(`/projects/${PROJECT_ID}/verification`);
    await expect(
      page.getByRole("heading", { name: "Verifica que la API es tuya", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(CODE).first()).toBeVisible();
    await expect(
      page.getByText("https://api.tienda-ejemplo.com/.well-known/hindama-verificacion.txt"),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Registro DNS TXT" }).click();
    await expect(page.getByText("_hindama-verificacion.api.tienda-ejemplo.com")).toBeVisible();
    await expect(page.getByText("La propagación puede tardar")).toBeVisible();
  });

  test("un 422 muestra el motivo y lo encontrado; al verificar se actualiza el proyecto", async ({
    page,
  }) => {
    await mockBff(page, `**/api/projects/${PROJECT_ID}`, { body: newPending() }, "GET");
    const calls = await mockBff(
      page,
      VERIFY,
      {
        status: 422,
        body: {
          ...problem(422, "verification.content_mismatch"),
          found: "HTTP 200: <script>alert(1)</script>",
        },
      },
      "POST",
    );
    await page.goto(`/projects/${PROJECT_ID}/verification`);
    await expect(page.getByText("Pendiente de verificación").first()).toBeVisible();
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page.getByText("el contenido del archivo es distinto")).toBeVisible();
    await expect(page.getByText("Esperábamos")).toBeVisible();
    // Lo encontrado es texto del host: se muestra escapado, nunca como HTML.
    await expect(page.getByText("HTTP 200: <script>alert(1)</script>")).toBeVisible();
    expect(calls[0].postDataJSON()).toEqual({ method: "file" });

    await page.unrouteAll();
    await mockBff(
      page,
      VERIFY,
      { body: { ...PENDING_VERIFICATION, status: "verified", method: "dns" } },
      "POST",
    );
    await page.getByRole("tab", { name: "Registro DNS TXT" }).click();
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page.getByText("Propiedad verificada").first()).toBeVisible();
    await expect(page.getByText("Comprobamos que controlas api.tienda-ejemplo.com")).toBeVisible();
  });

  for (const [code, text] of [
    ["verification.file_not_found", "no encontramos el archivo"],
    ["verification.txt_missing", "no encontramos el registro TXT"],
    ["verification.connection_error", "no logramos conectar con el host"],
    ["verification.destination_not_allowed", "dirección no permitida"],
  ]) {
    test(`${code} explica cómo corregirlo`, async ({ page }) => {
      await mockBff(page, VERIFY, { status: 422, body: problem(422, code) }, "POST");
      await page.goto(`/projects/${PROJECT_ID}/verification`);
      await page.getByRole("button", { name: "Verificar", exact: true }).click();
      await expect(page.getByText(text).first()).toBeVisible();
    });
  }

  test("429 y 500 se avisan sin perder la vista", async ({ page }) => {
    await mockBff(
      page,
      VERIFY,
      { status: 429, body: problem(429, "rate_limit.exceeded"), headers: { "Retry-After": "5" } },
      "POST",
    );
    await page.goto(`/projects/${PROJECT_ID}/verification`);
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page.getByText("Demasiados intentos.")).toBeVisible();
    await page.unrouteAll();
    await mockBff(page, VERIFY, { status: 500, body: problem(500, "internal.error") }, "POST");
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page.getByText("Referencia: req-e2e-500")).toBeVisible();
  });

  test("si no se puede cargar la verificación muestra el error con su referencia", async ({
    page,
  }) => {
    await mockBff(page, VERIFY, { status: 503, body: problem(503, "service.unavailable") }, "GET");
    await page.goto(`/projects/${PROJECT_ID}/verification`);
    await expect(page.getByText("req-e2e-503")).toBeVisible();
  });

  test("copiar el código avisa y deja el texto en el portapapeles", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/projects/${PROJECT_ID}/verification`);
    await page.getByRole("button", { name: "Copiar código" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE);
  });
});

test.describe("V-19 y V-20 contrato y versiones", () => {
  const CONTRACTS = `**/api/projects/${PROJECT_ID}/contracts`;
  const noContract = (page: Parameters<typeof mockBff>[0]) =>
    mockBff(
      page,
      `**/api/projects/${PROJECT_ID}`,
      { body: project({ current_contract: null, last_run: null }) },
      "GET",
    );

  test("sin contrato: valida el archivo y la URL antes de importar", async ({ page }) => {
    await noContract(page);
    const calls = await mockBff(page, CONTRACTS, { status: 500, body: {} }, "POST");
    await page.goto(`/projects/${PROJECT_ID}/contract`);
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
    await page.getByLabel("URL del contrato").fill("file:///etc/passwd");
    await page.getByRole("button", { name: "Importar y comparar" }).click();
    await expect(page.getByText("Escribe una URL completa del contrato.")).toBeVisible();
    expect(calls).toHaveLength(0);
  });

  test("importa un archivo con importContract y muestra los avisos de la versión", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith(`/api/projects/${PROJECT_ID}/contracts`) && r.method() === "POST") {
        requests.push(r.headers()["content-type"] ?? "");
      }
    });
    // Prism responde el 200 («idéntico»); la versión nueva es el 201 con el ejemplo del contrato.
    await mockBff(page, CONTRACTS, { status: 201, body: CONTRACT_V2 }, "POST");
    await page.goto(`/projects/${PROJECT_ID}/contract`);
    // Ejemplo `ContractVersion`: la versión vigente, con dos avisos.
    await expect(page.getByRole("heading", { name: "API de pedidos", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2 avisos de esta versión" })).toBeVisible();
    await expect(
      page.getByText("El contrato declara servidores distintos a tu URL base").first(),
    ).toBeVisible();

    await page.locator("#contract-file").setInputFiles(YAML);
    await expect(page.getByText("pedidos-v2.4.yaml").first()).toBeVisible();
    await page.getByRole("button", { name: "Importar y comparar" }).click();
    await expect(page.getByText("Contrato importado")).toBeVisible();
    expect(requests[0]).toMatch(/^multipart\/form-data; boundary=/);
  });

  test("un documento inválido muestra la ubicación de cada error", async ({ page }) => {
    await mockBff(
      page,
      CONTRACTS,
      {
        status: 422,
        body: {
          ...problem(422, "contract.invalid"),
          errors: [{ field: "/paths/~1orders/get", code: "contract.invalid", message: "" }],
        },
      },
      "POST",
    );
    await page.goto(`/projects/${PROJECT_ID}/contract`);
    await page.locator("#contract-file").setInputFiles(YAML);
    await page.getByRole("button", { name: "Importar y comparar" }).click();
    await expect(page.getByText("El documento no es un OpenAPI válido.")).toBeVisible();
    await expect(page.getByText("/paths/~1orders/get")).toBeVisible();
  });

  for (const [code, text] of [
    ["contract.unsupported_version", "Solo se aceptan contratos OpenAPI 3.0 y 3.1."],
    ["contract.url_unreachable", "No pudimos descargar el contrato desde esa URL."],
    ["contract.url_not_allowed", "Esa URL apunta a una dirección no permitida."],
  ]) {
    test(`importar por URL: ${code}`, async ({ page }) => {
      await mockBff(page, CONTRACTS, { status: 422, body: problem(422, code) }, "POST");
      await page.goto(`/projects/${PROJECT_ID}/contract`);
      await page.getByRole("tab", { name: "Desde URL" }).click();
      await page.getByLabel("URL del contrato").fill("https://docs.tienda.mx/openapi.yaml");
      await page.getByRole("button", { name: "Importar y comparar" }).click();
      await expect(page.getByText(text)).toBeVisible();
    });
  }

  test("un documento idéntico no crea versión y lo avisa", async ({ page }) => {
    await mockBff(
      page,
      CONTRACTS,
      {
        status: 200,
        body: {
          ...CONTRACT_V2,
          warnings: [{ code: "contract.unchanged", message: "", location: null }],
        },
      },
      "POST",
    );
    await page.goto(`/projects/${PROJECT_ID}/contract`);
    await page.locator("#contract-file").setInputFiles(YAML);
    await page.getByRole("button", { name: "Importar y comparar" }).click();
    await expect(page.getByText("Esta versión es idéntica a la anterior")).toBeVisible();
  });

  test("las operaciones salen de listOperations y el método filtra en la API", async ({ page }) => {
    const calls = await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/operations?*`,
      {
        body: {
          items: [
            {
              id: "0192e3a0-5555-7000-8000-000000000003",
              method: "GET",
              path: "/orders/{orderId}",
              operation_id: "getOrder",
              summary: "Obtiene un pedido",
              tags: ["orders"],
              parameters: [{ name: "orderId", location: "path", required: true, type: "string" }],
              body: null,
              security: [{ scheme: "bearerAuth", type: "http_bearer" }],
              retired_at: null,
              suggested_policy: "owner_only",
              policy: null,
              owner_field: null,
              confirmed_at: null,
              modified_at: null,
              resource_parameters: [],
              is_login_candidate: false,
            },
          ],
          total: 18,
          page: 1,
          page_size: 100,
        },
      },
      "GET",
    );
    await page.goto(`/projects/${PROJECT_ID}/contract`);
    await expect(page.getByRole("heading", { name: "18 operaciones" })).toBeVisible();
    await page.getByRole("button", { name: "Detalle de GET /orders/{orderId}" }).click();
    await expect(page.getByText("bearerAuth (HTTP bearer)")).toBeVisible();
    await expect(page.getByText("ruta · string")).toBeVisible();
    await page.getByRole("button", { name: "DELETE", exact: true }).click();
    await expect
      .poll(() => calls.map((c) => new URL(c.url()).searchParams.get("method")))
      .toContain("DELETE");
  });

  test("política sin contrato pide importarlo primero", async ({ page }) => {
    await page.goto("/projects/pagos/policy");
    await expect(page.getByText("Primero importa el contrato")).toBeVisible();
    await expect(page.getByRole("link", { name: "Importar contrato" })).toHaveAttribute(
      "href",
      /\/projects\/pagos\/contract$/,
    );
  });

  test("versiones: lista las de la API y muestra los cambios frente a la anterior", async ({
    page,
  }) => {
    await page.goto(`/projects/${PROJECT_ID}/contract/versions`);
    await expect(page.getByRole("heading", { name: "2 versiones" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "v2 frente a v1" })).toBeVisible();
    await expect(page.getByText("/orders/{orderId}").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a la política" })).toHaveAttribute(
      "href",
      /\/policy$/,
    );
    await expect(page.getByRole("link", { name: "Volver a la versión actual" })).toBeVisible();
  });

  test("versiones: la primera no tiene con qué compararse", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/contracts/*`,
      {
        body: {
          id: "0192e3a0-3333-7000-8000-000000000001",
          number: 1,
          source: "file",
          openapi_version: "3.0.3",
          operation_count: 17,
          imported_at: "2026-11-02T15:10:00Z",
          source_url: null,
          file_name: "pedidos.yaml",
          format: "yaml",
          api_title: "API de pedidos",
          sha256: "ab".repeat(32),
          is_current: false,
          warnings: [],
          changes: null,
        },
      },
      "GET",
    );
    await page.goto(`/projects/${PROJECT_ID}/contract/versions`);
    await page.getByRole("button", { name: /Versión 1/ }).click();
    await expect(page.getByText("La versión 1 es la primera importada")).toBeVisible();
  });
});

test.describe("V-21 y V-22 identidades", () => {
  const IDENTITIES = `**/api/projects/${PROJECT_ID}/identities`;
  const USER_A = "0192e3a0-6666-7000-8000-000000000002";
  // Credencial de prueba armada en tiempo de ejecución: no es un secreto real.
  const TOKEN = ["tok", "9f8e", "7d6c"].join("-");

  test("lista las identidades de la API con los requisitos de cada módulo", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/identities`);
    // Ejemplo `IdentityPage`: la anónima y «Usuario A».
    await expect(page.getByRole("heading", { name: "2 identidades" })).toBeVisible();
    await expect(page.getByText("Siempre existe")).toBeVisible();
    await expect(page.getByText("••••7f3a")).toBeVisible();
    await expect(page.getByText("Usuario: cliente")).toBeVisible();
    // El proyecto del ejemplo informa que faltan identidades y una administradora.
    await expect(
      page.getByText(
        "Una identidad normal y una con rol de administrador. Te falta la administradora.",
      ),
    ).toBeVisible();
  });

  test("probar una credencial muestra el resultado de testIdentity", async ({ page }) => {
    const calls = await mockBff(
      page,
      `${IDENTITIES}/${USER_A}/test`,
      {
        body: {
          succeeded: false,
          status_code: 401,
          failure: "rejected",
          operation: { id: "0192e3a0-5555-7000-8000-000000000001", method: "GET", path: "/orders" },
          tested_at: "2026-11-16T10:01:00Z",
        },
      },
      "POST",
    );
    await page.goto(`/projects/${PROJECT_ID}/identities`);
    const row = page.getByRole("listitem").filter({ hasText: "Usuario A" });
    await row.getByRole("button", { name: "Probar" }).click();
    await expect(page.getByText("Usuario A: la credencial falló")).toBeVisible();
    await expect(page.getByText("La API respondió 401.")).toBeVisible();
    expect(calls[0].postDataJSON()).toEqual({});
  });

  test("probar sin verificar el proyecto no está disponible", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}`,
      { body: project({ verification_status: "pending", verified_at: null }) },
      "GET",
    );
    await page.goto(`/projects/${PROJECT_ID}/identities`);
    const row = page.getByRole("listitem").filter({ hasText: "Usuario A" });
    await expect(row.getByRole("button", { name: "Probar" })).toBeDisabled();
  });

  test("eliminar una identidad pide confirmación y explica una ejecución activa", async ({
    page,
  }) => {
    await mockBff(
      page,
      `${IDENTITIES}/${USER_A}`,
      { status: 409, body: problem(409, "project.active_run") },
      "DELETE",
    );
    await page.goto(`/projects/${PROJECT_ID}/identities`);
    await page.getByRole("button", { name: "Eliminar Usuario A" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Sus hallazgos se conservan.")).toBeVisible();
    await dialog.getByRole("button", { name: "Eliminar identidad" }).click();
    await expect(dialog.getByText("Hay una ejecución en cola o en curso")).toBeVisible();

    await page.unrouteAll();
    const calls = await mockBff(page, `${IDENTITIES}/${USER_A}`, { status: 204 }, "DELETE");
    await dialog.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Identidad «Usuario A» eliminada")).toBeVisible();
    expect(calls).toHaveLength(1);
  });

  test("agregar: valida los campos, envía la credencial una vez y vuelve a la lista", async ({
    page,
  }) => {
    const calls: { body: unknown }[] = [];
    await page.route(IDENTITIES, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      calls.push({ body: route.request().postDataJSON() });
      await route.fallback();
    });
    await page.goto(`/projects/${PROJECT_ID}/identities/new`);
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText("Este campo es obligatorio.").first()).toBeVisible();
    expect(calls).toHaveLength(0);

    await page.getByLabel("Nombre", { exact: true }).fill("Administradora");
    await page.getByRole("radio", { name: "Administrador" }).click();
    await page.getByLabel("Token", { exact: true }).fill(TOKEN);
    await page.getByRole("button", { name: "Guardar identidad" }).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}/identities$`));
    await expect(page.getByText("Identidad «Usuario A» guardada")).toBeVisible();
    expect(calls[0].body).toEqual({
      name: "Administradora",
      role: "admin",
      role_label: null,
      auth_type: "bearer",
      credential: { token: TOKEN },
      field_name: null,
      login_operation_id: null,
    });
    // La credencial no queda en el navegador.
    const stored = await page.evaluate(
      () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
    );
    expect(stored).not.toContain(TOKEN);
  });

  test("agregar: un nombre repetido y una cabecera reservada se marcan en su campo", async ({
    page,
  }) => {
    await mockBff(
      page,
      IDENTITIES,
      { status: 409, body: problem(409, "identity.name_taken") },
      "POST",
    );
    await page.goto(`/projects/${PROJECT_ID}/identities/new`);
    await page.getByLabel("Nombre", { exact: true }).fill("Usuario A");
    await page.getByLabel("Token", { exact: true }).fill(TOKEN);
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText("Ya hay una identidad con ese nombre. Elige otro.")).toBeVisible();

    await page.unrouteAll();
    await mockBff(
      page,
      IDENTITIES,
      {
        status: 422,
        body: {
          ...problem(422, "validation.failed"),
          errors: [{ field: "field_name", code: "identity.field_name_reserved", message: "" }],
        },
      },
      "POST",
    );
    await page.getByRole("radio", { name: "Cabecera personalizada" }).click();
    await page.getByLabel("Nombre de la cabecera").fill("Host");
    await page.getByLabel("Valor", { exact: true }).fill(TOKEN);
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText("Esa cabecera la controla la plataforma; usa otra.")).toBeVisible();
  });

  test("editar: la credencial queda enmascarada y solo se envía lo que cambia", async ({
    page,
  }) => {
    const calls = await mockBff(
      page,
      `${IDENTITIES}/${USER_A}`,
      {
        body: {
          id: USER_A,
          name: "Usuario B",
          role: "user",
          role_label: "cliente",
          auth_type: "bearer",
          credential_suffix: "7f3a",
          field_name: null,
          login_operation: null,
          status: "active",
          last_tested_at: null,
          last_test_status_code: null,
          resource_count: 3,
          warnings: [],
          created_at: "2026-11-16T10:00:00Z",
        },
      },
      "PATCH",
    );
    await page.goto(`/projects/${PROJECT_ID}/identities/${USER_A}`);
    await expect(page.getByRole("heading", { name: "Editar identidad", level: 1 })).toBeVisible();
    await expect(page.getByText("Termina en ••••7f3a")).toBeVisible();
    await page.getByLabel("Nombre", { exact: true }).fill("Usuario B");
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText("Identidad «Usuario B» guardada")).toBeVisible();
    expect(calls[0].postDataJSON()).toEqual({ name: "Usuario B" });
  });

  test("editar una identidad que no existe muestra el 404", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/identities/0192e3a0-6666-7000-8000-00000000ffff`);
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
  });
});

test.describe("V-23 recursos por identidad", () => {
  const RESOURCES = `**/api/projects/${PROJECT_ID}/resources**`;
  const USER_A = "0192e3a0-6666-7000-8000-000000000002";
  const ORDER_BY_ID = "0192e3a0-5555-7000-8000-000000000003";
  const DISCOVERED = {
    id: "0192e3a0-7777-7000-8000-000000000009",
    identity_id: USER_A,
    resource_type: "pedido",
    value: "303",
    source: "discovered",
    confirmed: false,
    created_at: "2026-11-16T10:07:00Z",
  };
  const page1 = (items: unknown[]) => ({ items, total: items.length, page: 1, page_size: 100 });

  test("muestra los identificadores del contrato y los recursos de cada identidad", async ({
    page,
  }) => {
    await page.goto(`/projects/${PROJECT_ID}/resources`);
    await expect(
      page.getByRole("heading", { name: "Recursos por identidad", level: 1 }),
    ).toBeVisible();
    // Ejemplo `OperationPage`: /orders/{orderId} identifica un «pedido».
    await expect(page.getByRole("checkbox", { name: "orderId es identificador" })).toBeChecked();
    await expect(page.getByLabel("Tipo de recurso de orderId")).toHaveValue("pedido");
    // La anónima no tiene recursos y no aparece; «Usuario A» trae su `resource_count`.
    await expect(page.getByRole("radio", { name: "Usuario A · 3" })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Anónimo/ })).toHaveCount(0);
    await expect(page.getByText("101", { exact: true })).toBeVisible();
    // El descubrimiento aún no existe en el backend.
    await expect(page.getByRole("button", { name: "Descubrir recursos" })).toBeDisabled();
    await expect(page.getByText("aún no está disponible")).toBeVisible();
  });

  test("cambiar un identificador envía la selección completa con updateOperation", async ({
    page,
  }) => {
    const calls = await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/operations/${ORDER_BY_ID}`,
      { status: 422, body: problem(422, "validation.failed") },
      "PATCH",
    );
    await page.goto(`/projects/${PROJECT_ID}/resources`);
    const type = page.getByLabel("Tipo de recurso de orderId");
    await type.fill("");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Escribe el tipo de recurso.")).toBeVisible();
    expect(calls).toHaveLength(0);

    await page.getByRole("checkbox", { name: "orderId es identificador" }).uncheck();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("No se pudo completar la acción")).toBeVisible();
    expect(calls[0].postDataJSON()).toEqual({ resource_parameters: [] });
  });

  test("confirmar un recurso descubierto lo marca con updateResource", async ({ page }) => {
    await mockBff(page, RESOURCES, { body: page1([DISCOVERED]) }, "GET");
    const calls = await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/resources/${DISCOVERED.id}`,
      { body: { ...DISCOVERED, confirmed: true } },
      "PATCH",
    );
    await page.goto(`/projects/${PROJECT_ID}/resources`);
    const row = page.getByRole("listitem").filter({ hasText: "303" });
    await expect(row.getByText("Descubierto")).toBeVisible();
    await expect(row.getByText("Por confirmar")).toBeVisible();
    await row.getByRole("button", { name: "Confirmar" }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].postDataJSON()).toEqual({ confirmed: true });
  });

  test("agregar a mano: valida, explica un dueño repetido y envía createResource", async ({
    page,
  }) => {
    const calls: unknown[] = [];
    let owned = true;
    await page.route(`**/api/projects/${PROJECT_ID}/resources`, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      calls.push(route.request().postDataJSON());
      if (owned) {
        owned = false;
        return route.fulfill({
          status: 409,
          contentType: "application/problem+json",
          body: JSON.stringify(problem(409, "resource.owned_by_other")),
        });
      }
      await route.fallback();
    });
    await page.goto(`/projects/${PROJECT_ID}/resources`);
    await page.getByRole("button", { name: "Agregar a Usuario A" }).click();
    await expect(page.getByText("Escribe el identificador del recurso.")).toBeVisible();
    expect(calls).toHaveLength(0);

    await page.getByLabel("Tipo", { exact: true }).fill("pedido");
    await page.getByLabel("Identificador", { exact: true }).fill(" 202 ");
    await page.getByRole("button", { name: "Agregar a Usuario A" }).click();
    await expect(page.getByText("Ese recurso ya pertenece a otra identidad.")).toBeVisible();

    await page.getByLabel("Identificador", { exact: true }).fill("404");
    await page.getByRole("button", { name: "Agregar a Usuario A" }).click();
    await expect(page.getByText("Recurso agregado a Usuario A")).toBeVisible();
    expect(calls).toEqual([
      { identity_id: USER_A, resource_type: "pedido", value: "202" },
      { identity_id: USER_A, resource_type: "pedido", value: "404" },
    ]);
  });

  test("eliminar un recurso pide confirmación y usa deleteResource", async ({ page }) => {
    const calls = await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/resources/0192e3a0-7777-7000-8000-000000000001`,
      { status: 204 },
      "DELETE",
    );
    await page.goto(`/projects/${PROJECT_ID}/resources`);
    await page.getByRole("button", { name: "Eliminar 101" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("No se borra nada en tu API.")).toBeVisible();
    await dialog.getByRole("button", { name: "Eliminar recurso" }).click();
    await expect(page.getByText("Se eliminó «101»")).toBeVisible();
    expect(calls).toHaveLength(1);
  });

  test("una identidad sin recursos avisa que Acceso a objetos no podrá probarla", async ({
    page,
  }) => {
    await mockBff(page, RESOURCES, { body: page1([]) }, "GET");
    await page.goto(`/projects/${PROJECT_ID}/resources`);
    await expect(page.getByText("Usuario A no tiene recursos")).toBeVisible();
  });

  test("sin identidades con credencial pide agregar una", async ({ page }) => {
    await mockBff(
      page,
      `**/api/projects/${PROJECT_ID}/identities**`,
      {
        body: {
          items: [
            {
              id: "0192e3a0-6666-7000-8000-000000000001",
              name: "Anónimo",
              role: "other",
              role_label: null,
              auth_type: "none",
              credential_suffix: null,
              field_name: null,
              login_operation: null,
              status: "active",
              last_tested_at: null,
              last_test_status_code: null,
              resource_count: 0,
              warnings: [],
              created_at: "2026-11-16T09:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        },
      },
      "GET",
    );
    await page.goto(`/projects/${PROJECT_ID}/resources`);
    await expect(page.getByText("Aún no hay identidades")).toBeVisible();
    await expect(page.getByRole("link", { name: "Agregar identidad" })).toBeVisible();
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
