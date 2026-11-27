import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/http";
import { errorPanelProps } from "./from-api-error";

describe("errorPanelProps", () => {
  it("muestra el request_id en los 500 y 503", () => {
    expect(
      errorPanelProps(new ApiError({ status: 500, code: "internal", requestId: "r1" })),
    ).toEqual({ code: 500, reference: "r1", retryAfter: undefined });
    expect(
      errorPanelProps(new ApiError({ status: 503, code: "service.unavailable", requestId: "r2" })),
    ).toMatchObject({ code: 503, reference: "r2" });
    expect(errorPanelProps(new ApiError({ status: 502, requestId: "r3" }))).toMatchObject({
      code: 500,
      reference: "r3",
    });
  });

  it("no muestra el request_id fuera de los 5xx y pasa Retry-After en el 429", () => {
    expect(errorPanelProps(new ApiError({ status: 403, requestId: "r" }))).toEqual({
      code: 403,
      reference: undefined,
      retryAfter: undefined,
    });
    expect(errorPanelProps(new ApiError({ status: 429, retryAfter: 12 }))).toMatchObject({
      code: 429,
      retryAfter: 12,
    });
  });

  it("devuelve null para errores que van junto al campo", () => {
    expect(errorPanelProps(new ApiError({ status: 422, code: "validation.failed" }))).toBeNull();
  });
});
