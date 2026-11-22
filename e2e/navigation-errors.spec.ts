import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Next 16 (Cache Components + Partial Prefetching) valida en desarrollo cada vista y avisa en la
 * terminal, en la consola y en el overlay de errores cuando algo impide una navegación instantánea.
 * Estas pruebas reproducen los avisos que aparecían al navegar entre vistas (ver
 * `docs/errores-navegacion.md`): ninguna ruta debe producirlos ni al cargarla ni al llegar a ella
 * con un enlace de la app.
 */

/** Ejemplo `Project` del contrato: lo devuelve el simulador para cualquier UUID. */
const API_PROJECT = "/projects/0192e3a0-2222-7000-8000-000000000001";

const PROJECT_ROUTES = [
  API_PROJECT,
  `${API_PROJECT}/settings`,
  `${API_PROJECT}/verification`,
  `${API_PROJECT}/contract`,
  `${API_PROJECT}/contract/versions`,
  `${API_PROJECT}/identities`,
  `${API_PROJECT}/identities/new`,
  `${API_PROJECT}/identities/0192e3a0-6666-7000-8000-000000000002`,
  `${API_PROJECT}/resources`,
  `${API_PROJECT}/policy`,
  "/projects/pedidos/history",
  "/projects/pedidos/findings",
  "/projects/pedidos/findings/f01",
  "/projects/pedidos/runs/new",
  "/projects/pedidos/runs/current",
  "/projects/pedidos/runs/3",
  "/projects/pedidos/runs/3/matrix",
  "/projects/pedidos/runs/3/report",
];

const OTHER_ROUTES = [
  "/",
  "/projects",
  "/projects/new",
  "/projects/new/terms",
  "/admin",
  "/admin/audit-log",
  "/profile",
  "/sign-in",
];

/** Registra los errores de consola y de página, salvo la carga fallida de un 404 intencional. */
function watchConsole(page: Page, ignore: RegExp = /^$/) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    if (!ignore.test(text)) errors.push(text.replace(/\s+/g, " ").slice(0, 300));
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message.slice(0, 300)}`));
  return errors;
}

/** Texto del diálogo de errores/avisos de Next (vive en un shadow DOM), o `null` si no se abrió. */
async function nextOverlay(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const dialog = document
      .querySelector("nextjs-portal")
      ?.shadowRoot?.querySelector("[data-nextjs-dialog]");
    return dialog ? (dialog.textContent ?? "").slice(0, 300) : null;
  });
}

test.describe("navegación sin avisos de Next", () => {
  for (const route of [...PROJECT_ROUTES, ...OTHER_ROUTES]) {
    for (const prefix of ["", "/en"]) {
      const path = prefix + (route === "/" && prefix ? "" : route);
      test(`${path || "/"} carga sin errores ni overlay`, async ({ page }) => {
        const errors = watchConsole(page);
        await page.goto(path);
        // El aviso de Next llega unos instantes después de hidratar.
        await page.waitForTimeout(1500);
        expect(await nextOverlay(page), "overlay de Next abierto").toBeNull();
        expect(errors).toEqual([]);
      });
    }
  }

  test("una ruta inexistente muestra el 404 sin overlay", async ({ page }) => {
    const errors = watchConsole(page, /Failed to load resource/);
    const response = await page.goto("/ruta-que-no-existe");
    expect(response?.status()).toBe(404);
    await page.waitForTimeout(1500);
    expect(await nextOverlay(page), "overlay de Next abierto").toBeNull();
    expect(errors).toEqual([]);
  });

  test("navegar con enlaces entre vistas de proyecto no abre el overlay", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchConsole(page);
    await page.goto(API_PROJECT);
    for (const name of ["Historial", "Hallazgos", "Identidades", "Política"]) {
      await page.getByRole("link", { name, exact: false }).first().click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1200);
      expect(await nextOverlay(page), `overlay de Next abierto tras ir a «${name}»`).toBeNull();
    }
    await page.goBack();
    await page.waitForTimeout(800);
    await page.goForward();
    await page.waitForTimeout(800);
    expect(await nextOverlay(page), "overlay de Next abierto tras atrás/adelante").toBeNull();
    expect(errors).toEqual([]);
  });
});
