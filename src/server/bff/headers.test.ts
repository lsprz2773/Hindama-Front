// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig, { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from "../../../next.config";

describe("cabeceras de seguridad (RNF-07)", () => {
  it("envía HSTS, CSP y nosniff en todas las rutas", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/:path*", headers: SECURITY_HEADERS }]);
    const names = SECURITY_HEADERS.map((h) => h.key);
    expect(names).toEqual([
      "Strict-Transport-Security",
      "Content-Security-Policy",
      "X-Content-Type-Options",
    ]);
    expect(SECURITY_HEADERS[2].value).toBe("nosniff");
  });

  it("la CSP permite el EventSource del mismo origen y nada externo", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:/);
  });
});
