import { describe, expect, it } from "vitest";
import {
  addDays,
  groupFor,
  isValidRange,
  niceStep,
  owaspKey,
  presetRange,
  spanDays,
} from "./stats";

describe("rangos de las estadísticas", () => {
  it("suma días en UTC sin depender de la zona", () => {
    expect(addDays("2026-11-22", -6)).toBe("2026-11-16");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("cuenta ambos extremos", () => {
    expect(spanDays("2026-11-16", "2026-11-22")).toBe(7);
    expect(spanDays("2026-11-22", "2026-11-22")).toBe(1);
  });

  it("arma los periodos de 7, 30 y 90 días y elige la agrupación", () => {
    expect(presetRange("2026-11-22", 7)).toEqual({
      dateFrom: "2026-11-16",
      dateTo: "2026-11-22",
      group: "day",
    });
    expect(presetRange("2026-11-22", 30).group).toBe("day");
    expect(presetRange("2026-11-22", 90)).toEqual({
      dateFrom: "2026-08-25",
      dateTo: "2026-11-22",
      group: "week",
    });
    expect(groupFor("2026-10-01", "2026-10-31")).toBe("day");
    expect(groupFor("2026-10-01", "2026-11-01")).toBe("week");
  });

  it("valida el rango como la API", () => {
    const today = "2026-11-22";
    expect(isValidRange("2026-11-01", "2026-11-22", today)).toBe(true);
    expect(isValidRange("2026-11-22", "2026-11-22", today)).toBe(true);
    expect(isValidRange("2026-11-23", "2026-11-22", today)).toBe(false);
    expect(isValidRange("2026-11-20", "2026-11-19", today)).toBe(false);
    expect(isValidRange("2026-11-01", "2026-11-23", today)).toBe(false);
    expect(isValidRange("2025-11-22", "2026-11-22", today)).toBe(true); // 366 días
    expect(isValidRange("2025-11-21", "2026-11-22", today)).toBe(false); // 367 días
    expect(isValidRange("", "2026-11-22", today)).toBe(false);
    expect(isValidRange("2026-02-31", "2026-11-22", today)).toBe(false);
  });

  it("quita el año de la categoría de OWASP", () => {
    expect(owaspKey("API1:2023")).toBe("API1");
    expect(owaspKey("API8")).toBe("API8");
  });

  it("separa las guías del eje en pasos redondos", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(9)).toBe(2);
    expect(niceStep(65)).toBe(20);
    expect(niceStep(312)).toBe(100);
    expect(niceStep(1032)).toBe(500);
  });
});
