import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLoadingPhase, type LoadStatus } from "./use-loading-phase";

describe("useLoadingPhase", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (initial: LoadStatus) =>
    renderHook(({ status }) => useLoadingPhase(status, { delay: 100, minDuration: 300 }), {
      initialProps: { status: initial },
    });

  it("no muestra nada al principio y luego el esqueleto", () => {
    const { result } = setup("loading");
    expect(result.current).toBe("pending");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("skeleton");
  });

  it("una carga rápida salta el esqueleto y evita el parpadeo", () => {
    const { result, rerender } = setup("loading");
    act(() => vi.advanceTimersByTime(40));
    rerender({ status: "ready" });
    expect(result.current).toBe("content");
  });

  it("el esqueleto visible se queda al menos el tiempo mínimo", () => {
    const { result, rerender } = setup("loading");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("skeleton");
    act(() => vi.advanceTimersByTime(50));
    rerender({ status: "ready" });
    expect(result.current).toBe("skeleton");
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe("content");
  });

  it("un error se muestra de inmediato si no había esqueleto", () => {
    const { result, rerender } = setup("loading");
    rerender({ status: "error" });
    expect(result.current).toBe("error");
  });

  it("recargar desde el contenido vuelve a empezar y reintentar sale del error", () => {
    const { result, rerender } = setup("ready");
    expect(result.current).toBe("content");
    rerender({ status: "loading" });
    expect(result.current).toBe("pending");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("skeleton");
    act(() => vi.advanceTimersByTime(300));
    rerender({ status: "error" });
    act(() => vi.advanceTimersByTime(10));
    expect(result.current).toBe("error");
    rerender({ status: "loading" });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("skeleton");
  });
});
