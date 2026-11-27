import { describe, expect, it } from "vitest";
import { formatDuration } from "./format-duration";

describe("formatDuration (F-20)", () => {
  it("una ejecución de 11 segundos dice 0:11, no «1 minuto»", () => {
    expect(formatDuration("2026-11-23T18:18:00Z", "2026-11-23T18:18:11Z")).toBe("0:11");
  });

  it("pasa de minutos con ceros a la izquierda", () => {
    expect(formatDuration("2026-11-23T18:00:00Z", "2026-11-23T18:03:05Z")).toBe("3:05");
  });

  it("sin inicio o sin fin no hay duración", () => {
    expect(formatDuration(null, "2026-11-23T18:00:00Z")).toBeNull();
    expect(formatDuration("2026-11-23T18:00:00Z", null)).toBeNull();
  });

  it("un fin anterior al inicio no da un valor negativo", () => {
    expect(formatDuration("2026-11-23T18:00:10Z", "2026-11-23T18:00:00Z")).toBe("0:00");
  });
});
