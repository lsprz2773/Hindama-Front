import { test as base } from "@playwright/test";
import { sessionCookieValue } from "./support/session";

export { expect } from "@playwright/test";

interface Options {
  /** Con `true` (por defecto) la prueba empieza con una sesión del BFF ya iniciada. */
  signedIn: boolean;
}

/**
 * - `page.goto` espera a que la página esté hidratada (marca `html[data-hydrated]`), de modo que
 *   ningún clic llegue antes de que React active los controles.
 * - Cada prueba arranca con la cookie de sesión cifrada del BFF (`signedIn`), así las vistas
 *   autenticadas llaman al simulador del contrato a través del BFF real.
 */
export const test = base.extend<Options>({
  signedIn: [true, { option: true }],
  context: async ({ context, signedIn }, provide) => {
    if (signedIn) {
      await context.addCookies([
        {
          name: "__Host-hindama_sesion",
          value: encodeURIComponent(sessionCookieValue()),
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
      ]);
    }
    await provide(context);
  },
  page: async ({ page }, runTest) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await page
        .locator("html[data-hydrated=true]")
        .waitFor({ state: "attached", timeout: 15_000 })
        .catch(() => {
          // Páginas sin el layout de la app (p. ej. el 404 genérico) no llevan la marca.
        });
      return response;
    };
    await runTest(page);
  },
});
