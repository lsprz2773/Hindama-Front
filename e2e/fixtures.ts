import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

/**
 * `page.goto` espera a que la página esté hidratada (marca `html[data-hydrated]`), de modo que
 * ningún clic llegue antes de que React active los controles.
 */
export const test = base.extend({
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
