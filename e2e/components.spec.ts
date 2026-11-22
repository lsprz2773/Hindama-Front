import { expect, test } from "./fixtures";

test.describe("fase 0 · componentes comunes", () => {
  test("toasts: se apilan como máximo 3 y se cierran", async ({ page }) => {
    await page.goto("/design-system");
    const buttons = ["success", "error", "warning", "info"];
    for (const name of buttons) await page.getByRole("button", { name, exact: true }).click();

    const toasts = page.locator("[aria-atomic=true]");
    await expect(toasts).toHaveCount(3);
    // El error anuncia con aria-live assertive.
    await expect(page.locator("[aria-atomic=true][aria-live=assertive]")).toHaveCount(1);

    await toasts.first().getByRole("button", { name: "Cerrar aviso" }).click();
    await expect(toasts).toHaveCount(2);
  });

  test("toast con acción: ejecuta la acción y se cierra", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "error", exact: true }).click();
    await page.locator("[aria-atomic=true]").getByRole("button", { name: "Reintentar" }).click();
    await expect(page.locator("[aria-atomic=true]")).toHaveCount(0);
  });

  test("eliminar con nombre: solo se habilita al escribirlo exacto y el foco va al campo", async ({
    page,
  }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Eliminar con nombre (C-07)" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Eliminar proyecto" });
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByRole("textbox")).toBeFocused();

    await page.keyboard.type("tienda api");
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("Tienda API");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(dialog).toBeHidden();
  });

  test("modal: Esc lo cierra y el foco regresa al botón que lo abrió", async ({ page }) => {
    await page.goto("/design-system");
    const opener = page.getByRole("button", { name: "Confirmar (C-06)" });
    await opener.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("modal: un error de la acción se muestra dentro y permite reintentar", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Con error" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Intentar" }).click();
    await expect(dialog.getByRole("alert")).toContainText("No se pudo completar la acción");
    await expect(dialog.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  test("aceptar riesgo: exige la justificación y guarda el motivo del contrato", async ({
    page,
  }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Aceptar riesgo (C-09)" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Descartar hallazgo" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Escribe una justificación.");
    // Solo espacios no cuenta: `DismissalCreate.justification` se recorta.
    await dialog.getByRole("textbox").fill("   ");
    await dialog.getByRole("button", { name: "Descartar hallazgo" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Escribe una justificación.");

    await dialog.getByRole("radio", { name: "Falso positivo" }).check();
    await dialog.getByRole("textbox").fill("La API solo se expone dentro de la red interna.");
    await expect(dialog.getByText("47/2000")).toBeVisible();
    await dialog.getByRole("button", { name: "Descartar hallazgo" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Decisión guardada" })).toContainText(
      "false_positive",
    );
  });

  test("insignias de estado: siempre llevan texto", async ({ page }) => {
    await page.goto("/design-system");
    const row = page.locator('[data-kind="run"]');
    for (const text of ["En cola", "En curso", "Completada", "Cancelada", "Fallida"]) {
      await expect(row.getByText(text, { exact: true })).toBeVisible();
    }
  });

  test("visor: recorta a 10 KB, enmascara y no interpreta el contenido", async ({ page }) => {
    await page.goto("/design-system");
    const response = page.getByRole("figure").filter({ hasText: "Respuesta · 200 OK" });
    await expect(response).toContainText("se recorta a partir de 10 KB");
    const rendered = await response.locator("pre").innerText();
    expect(rendered.length).toBeLessThanOrEqual(10 * 1024 + 20);
    await expect(page.getByRole("figure").filter({ hasText: "Petición" })).toContainText(
      "Bearer ••••••••••a9F2",
    );
  });

  test("copiar: cambia el icono, avisa con un toast y deja el texto en el portapapeles", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Copiar como curl" }).click();
    await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();
    await expect(page.locator("[aria-atomic=true]").getByText("Copiado")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("curl https://");
    // A los 2 s vuelve al texto original.
    await expect(page.getByRole("button", { name: "Copiar como curl" })).toBeVisible({
      timeout: 4000,
    });
  });

  test("módulos de riesgo: cada uno exige su propia confirmación", async ({ page }) => {
    await page.goto("/design-system");
    const panel = page.getByRole("region", { name: /Activaste módulos/ });
    await expect(panel.getByRole("status")).toContainText("Faltan por confirmar 2 módulos");
    await panel.getByRole("checkbox", { name: "Confirmar Inyección SQL" }).click();
    await expect(panel.getByRole("status")).toContainText("Falta confirmar 1 módulo");
    await panel.getByRole("checkbox", { name: "Confirmar Consumo de recursos" }).click();
    await expect(panel.getByRole("status")).toHaveCount(0);
  });

  test("ayuda contextual: siempre visible, con su título", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page.getByRole("complementary", { name: "¿Qué forma elijo?" })).toContainText(
      "Login automático",
    );
  });

  test("429 bloquea el reintento durante la cuenta regresiva", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page.getByRole("button", { name: /Reintentar en 0:\d\d/ })).toBeDisabled();
  });
});

test.describe("fase 0 · marco autenticado (C-01, C-02, C-03)", () => {
  test("barra lateral: grupo del proyecto, activo, bloqueado y contraer", async ({ page }) => {
    await page.goto("/design-system/shell");
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Proyectos" })).toBeVisible();
    // Estructura del proyecto con sus notas.
    await expect(nav.getByText("API de Pedidos")).toBeVisible();
    await expect(nav.getByText("42 op.")).toBeVisible();
    await expect(nav.getByText("Disponible tras verificar")).toBeVisible();
    // El elemento bloqueado no es un enlace.
    await expect(nav.getByRole("link", { name: "Recursos" })).toHaveCount(0);

    const collapse = nav.getByRole("button", { name: "Contraer menú" });
    await collapse.click();
    await expect(nav.getByRole("button", { name: "Expandir menú" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(nav.getByText("42 op.")).toBeHidden();
  });

  test("la ruta de navegación marca la página actual", async ({ page }) => {
    await page.goto("/design-system/shell");
    const crumbs = page.getByRole("navigation", { name: "Ruta" });
    await expect(crumbs.getByRole("link", { name: "Proyectos" })).toHaveAttribute(
      "href",
      "/projects",
    );
    await expect(crumbs.getByText("Hallazgos")).toHaveAttribute("aria-current", "page");
  });

  test("menú de usuario: perfil, idioma y cerrar sesión", async ({ page }) => {
    await page.goto("/design-system/shell");
    await page.getByRole("button", { name: /Ana López/ }).click();
    await expect(page.getByRole("menuitem", { name: "Perfil" })).toBeVisible();
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/design-system\/shell$/);
  });
});

for (const scheme of ["dark", "light"] as const) {
  test.describe(`paleta en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const path of ["/sign-in", "/", "/design-system", "/design-system/shell"]) {
      test(`${path}: tokens del tema y sin desbordamiento horizontal`, async ({ page }) => {
        await page.goto(path);
        const tokens = await page.evaluate(() => {
          const s = getComputedStyle(document.documentElement);
          return {
            text: s.getPropertyValue("--text").trim(),
            scheme: s.colorScheme,
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
        expect(tokens.scheme).toBe(scheme);
        expect(tokens.text).toBe(scheme === "dark" ? "#f5f2ee" : "#1c1915");
        expect(tokens.overflow).toBe(false);
      });
    }

    test("el texto principal y el atenuado cumplen contraste AA sobre el panel", async ({
      page,
    }) => {
      await page.goto("/sign-in");
      const ratios = await page.evaluate((scheme) => {
        const luminance = (rgb: number[]) => {
          const [r, g, b] = rgb.map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        // Superficie de los paneles: el vidrio (blanco 6 % / 66 %) sobre el degradado base del tema.
        const base = scheme === "dark" ? [49, 50, 53] : [242, 242, 243];
        const ratio = (fg: string) => {
          const l1 = luminance(parse(fg));
          const l2 = luminance(base);
          const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
          return (hi + 0.05) / (lo + 0.05);
        };
        const probe = (name: string) => {
          const el = document.createElement("span");
          el.style.color = `var(${name})`;
          document.body.append(el);
          const color = getComputedStyle(el).color;
          el.remove();
          return color;
        };
        return {
          text: ratio(probe("--text")),
          muted: ratio(probe("--muted")),
          link: ratio(probe("--link")),
        };
      }, scheme);
      expect(ratios.text).toBeGreaterThanOrEqual(4.5);
      expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
      expect(ratios.link).toBeGreaterThanOrEqual(4.5);
    });
  });
}
