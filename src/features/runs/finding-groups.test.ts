import { describe, expect, it } from "vitest";
import { groupByType } from "./finding-groups";

const item = (
  finding_type: string,
  title: string,
  severity: "critical" | "high" | "medium" | "low" | "info",
) => ({
  finding_type,
  title,
  severity,
});

describe("groupByType (B21)", () => {
  it("junta los hallazgos del mismo tipo y cuenta cuántos son", () => {
    const groups = groupByType([
      item("jwt_alg_none", "La API acepta un JWT sin firma", "critical"),
      item("bola", "Una identidad lee datos de otra", "high"),
      item("jwt_alg_none", "La API acepta un JWT sin firma", "critical"),
      item("jwt_alg_none", "La API acepta un JWT sin firma", "critical"),
    ]);
    expect(groups).toEqual([
      {
        type: "jwt_alg_none",
        title: "La API acepta un JWT sin firma",
        severity: "critical",
        count: 3,
      },
      { type: "bola", title: "Una identidad lee datos de otra", severity: "high", count: 1 },
    ]);
  });

  it("ordena por severidad y, a igual severidad, por cantidad", () => {
    const groups = groupByType([
      item("a", "A", "low"),
      item("b", "B", "high"),
      item("c", "C", "high"),
      item("c", "C", "high"),
    ]);
    expect(groups.map((g) => g.type)).toEqual(["c", "b", "a"]);
  });

  it("toma la severidad más alta del tipo", () => {
    const [group] = groupByType([item("x", "X", "low"), item("x", "X", "high")]);
    expect(group.severity).toBe("high");
  });

  it("sin hallazgos no hay grupos", () => {
    expect(groupByType([])).toEqual([]);
  });
});
