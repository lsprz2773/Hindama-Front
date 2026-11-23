import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/api/schemas/admin";
import { ACTION_TONE, abbreviateId, isUserId, startOfDay } from "./audit";

describe("bitácora (V-34)", () => {
  it("cada acción del contrato tiene su color", () => {
    expect(Object.keys(ACTION_TONE).sort()).toEqual([...AUDIT_ACTIONS].sort());
  });

  it("abrevia un identificador sin perder sus extremos", () => {
    expect(abbreviateId("0192e3a0-1111-7000-8000-000000000001")).toBe("0192e3a0…0001");
  });

  it("solo busca por el identificador completo", () => {
    expect(isUserId("0192e3a0-1111-7000-8000-000000000001")).toBe(true);
    expect(isUserId("  0192E3A0-1111-7000-8000-000000000001 ")).toBe(true);
    expect(isUserId("luis@ejemplo.mx")).toBe(false);
    expect(isUserId("0192e3a0")).toBe(false);
    expect(isUserId("0192e3a0…0001")).toBe(false);
  });

  it("convierte un día en el inicio de ese día en la zona del navegador", () => {
    const start = startOfDay("2026-11-17");
    const next = startOfDay("2026-11-17", 1);
    expect(start).toBe(new Date(2026, 10, 17).toISOString());
    expect(next).toBe(new Date(2026, 10, 18).toISOString());
    expect(new Date(next as string).getTime()).toBeGreaterThan(new Date(start as string).getTime());
    // Pasa de mes y de año sin romperse.
    expect(startOfDay("2026-12-31", 1)).toBe(new Date(2027, 0, 1).toISOString());
  });

  it("no inventa una fecha si el campo está vacío o es inválido", () => {
    expect(startOfDay("")).toBeUndefined();
    expect(startOfDay("17/11/2026")).toBeUndefined();
  });
});
