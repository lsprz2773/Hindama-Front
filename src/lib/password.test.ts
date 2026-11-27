import { describe, expect, it } from "vitest";
import { checkPassword, isPasswordValid } from "./password";

describe("reglas de contraseña (RF-03)", () => {
  it("marca cada regla por separado", () => {
    expect(checkPassword("Hindama2026")).toEqual({
      length: false,
      upper: true,
      lower: true,
      digit: true,
      symbol: false,
    });
  });

  it("acepta una contraseña que cumple las cinco reglas", () => {
    expect(isPasswordValid("Hindama-2026!")).toBe(true);
  });

  it.each(["", "hindama-2026!", "HINDAMA-2026!", "Hindama-abcde!", "Hindama20260", "Corta-1A!"])(
    "rechaza %j",
    (value) => {
      expect(isPasswordValid(value)).toBe(false);
    },
  );
});
