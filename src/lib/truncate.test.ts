import { describe, expect, it } from "vitest";
import { MAX_VIEWER_BYTES, truncateBytes } from "./truncate";

describe("truncateBytes (visor de petición/respuesta)", () => {
  it("no toca un texto que cabe", () => {
    expect(truncateBytes("hola")).toEqual({ text: "hola", truncated: false, bytes: 4 });
  });

  it("recorta a 10 KB y lo indica", () => {
    const result = truncateBytes("a".repeat(MAX_VIEWER_BYTES + 500));
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(MAX_VIEWER_BYTES);
    expect(result.bytes).toBe(MAX_VIEWER_BYTES + 500);
  });

  it("no parte un carácter de varios bytes por la mitad", () => {
    // «ñ» ocupa 2 bytes: con un límite de 5 caben dos «ñ» (4 bytes), no una mitad.
    const result = truncateBytes("ññññ", 5);
    expect(result.text).toBe("ññ");
    expect(result.text).not.toContain("�");
  });
});
