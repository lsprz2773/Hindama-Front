import { expect, test } from "./fixtures";

/** RNF-07 y guía del frontend §3: HSTS, CSP y `nosniff` en las páginas y en el BFF. */
const ROUTES = ["/", "/sign-in", "/projects", "/en/terms", "/api/me", "/api/auth/session"];

for (const route of ROUTES) {
  test(`cabeceras de seguridad en ${route}`, async ({ request }) => {
    const response = await request.get(route, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    // El EventSource del progreso es del mismo origen.
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
}

test("la cookie de sesión nunca es legible desde JavaScript", async ({ page }) => {
  await page.goto("/projects");
  const cookies = await page.evaluate(() => document.cookie);
  expect(cookies).not.toContain("hindama_sesion");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toMatch(/token|sesion|csrf/i);
});
