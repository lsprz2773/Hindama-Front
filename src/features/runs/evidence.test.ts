import { describe, expect, it } from "vitest";
import { contextNotes } from "./evidence";

describe("contextNotes", () => {
  it("lee las claves de los módulos de propiedades, consumo de recursos e inyección SQL", () => {
    expect(
      contextNotes({
        undeclared: ["is_admin", "internal_note"],
        accepted_fields: ["role"],
        created_resource: "failed",
        requests: 40,
        request_body_bytes: 8_388_608,
        operation: "GET /orders",
        parameter: "id",
        payload: "' OR 1=1 --",
      }),
    ).toEqual([
      { id: "undeclared", names: "is_admin, internal_note" },
      { id: "acceptedFields", names: "role" },
      { id: "createdResource", status: "failed" },
      { id: "requests", count: 40 },
      { id: "bodyBytes", count: 8_388_608 },
      { id: "operation", value: "GET /orders" },
      { id: "parameter", value: "id" },
      { id: "payload", value: "' OR 1=1 --" },
    ]);
  });

  it("ignora las claves que no conoce y los valores con otra forma", () => {
    expect(
      contextNotes({
        resource: { type: "order", value: "1", owner: null },
        control_identity: "ana",
        undeclared: "no es una lista",
        created_resource: "otro",
        requests: "40",
        operation: "",
        payload: 7,
        nueva: true,
      }),
    ).toEqual([]);
  });

  it("recorta los textos largos y limita la lista de campos", () => {
    const [note] = contextNotes({ payload: "x".repeat(500) });
    expect(note).toEqual({ id: "payload", value: `${"x".repeat(200)}…` });
    const [names] = contextNotes({ undeclared: Array.from({ length: 30 }, (_, i) => `f${i}`) });
    expect(names).toMatchObject({ id: "undeclared" });
    expect((names as { names: string }).names.split(", ")).toHaveLength(20);
  });
});
