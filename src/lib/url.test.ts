import { describe, expect, it } from "vitest";
import { checkBaseUrl } from "./url";

describe("checkBaseUrl (URL base del proyecto)", () => {
  it("acepta HTTPS y avisa de HTTP", () => {
    expect(checkBaseUrl("https://api.pagos-staging.ejemplo.mx")).toMatchObject({
      ok: true,
      insecure: false,
      hostname: "api.pagos-staging.ejemplo.mx",
    });
    expect(checkBaseUrl("http://api.pagos-staging.ejemplo.mx")).toMatchObject({
      ok: true,
      insecure: true,
    });
  });

  it.each([
    ["no es una url", "invalid"],
    ["", "invalid"],
    ["ftp://ejemplo.mx", "protocol"],
    ["http://localhost:3000", "loopback"],
    ["http://127.0.0.1/v1", "loopback"],
    ["http://10.0.0.5", "private"],
    ["https://192.168.1.20", "private"],
    ["https://172.16.0.1", "private"],
    ["http://169.254.10.3", "linkLocal"],
    ["http://169.254.169.254/latest/meta-data", "metadata"],
  ])("rechaza %j (%s)", (value, problem) => {
    expect(checkBaseUrl(value)).toEqual({ ok: false, problem });
  });

  it("no confunde rangos públicos con privados", () => {
    expect(checkBaseUrl("https://172.32.0.1").ok).toBe(true);
    expect(checkBaseUrl("https://11.0.0.1").ok).toBe(true);
  });
});
