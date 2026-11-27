import { describe, expect, it } from "vitest";
import { defaultDuration } from "./toast";

describe("duración por defecto de los toasts (C-19)", () => {
  it("cierra éxito e información a los 5 s", () => {
    expect(defaultDuration({ type: "success" })).toBe(5000);
    expect(defaultDuration({ type: "info" })).toBe(5000);
  });

  it("deja los avisos 8 s", () => {
    expect(defaultDuration({ type: "warning" })).toBe(8000);
  });

  it("no cierra solo un error con acción ni el progreso", () => {
    expect(defaultDuration({ type: "error", action: { label: "x", onClick: () => {} } })).toBe(0);
    expect(defaultDuration({ type: "progress" })).toBe(0);
  });
});
