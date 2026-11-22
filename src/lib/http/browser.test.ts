import { afterEach, describe, expect, it, vi } from "vitest";
import { readCsrfToken, setCsrfToken } from "./browser";

afterEach(() => setCsrfToken(undefined));

describe("token anti-CSRF en el navegador", () => {
  it("lo pide una vez al BFF y lo guarda en memoria", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ authenticated: true, csrf_token: "tok" }),
    );
    expect(await readCsrfToken(fetchImpl)).toBe("tok");
    expect(await readCsrfToken(fetchImpl)).toBe("tok");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/auth/session");
  });

  it("sin sesión no guarda nada y vuelve a preguntar después", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 401 }));
    expect(await readCsrfToken(fetchImpl)).toBeUndefined();
    expect(await readCsrfToken(fetchImpl)).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
