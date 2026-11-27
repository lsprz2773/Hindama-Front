// @vitest-environment node
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseCookieHeader, SetCookieCollector } from "./cookies";
import {
  CHUNK_SIZE,
  clearSession,
  decryptSession,
  encryptSession,
  readSession,
  writeSession,
} from "./session";
import { parseSessionKey } from "./session-key";
import { KEY, session } from "./test-utils";

const noCookies = parseCookieHeader(null);

function cookieHeader(collector: SetCookieCollector) {
  return collector.values
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
}

describe("sesión cifrada del BFF (ADR-005)", () => {
  it("cifra con AES-256-GCM y solo guarda access token, refresh token, username y CSRF", () => {
    const value = encryptSession(session(), KEY);
    expect(value).not.toContain("refresh-token");
    expect(value).not.toContain("uuid-interno");
    expect(decryptSession(value, KEY)).toEqual(session());
    expect(Object.keys(decryptSession(value, KEY)!)).toEqual([
      "accessToken",
      "refreshToken",
      "username",
      "csrf",
    ]);
  });

  it("rechaza una cookie alterada o cifrada con otra llave (rotarla cierra las sesiones)", () => {
    const value = encryptSession(session(), KEY);
    const tampered = value.slice(0, -2) + (value.endsWith("A") ? "BB" : "AA");
    expect(decryptSession(tampered, KEY)).toBeNull();
    expect(decryptSession(value, randomBytes(32))).toBeNull();
    expect(decryptSession("basura", KEY)).toBeNull();
  });

  it("escribe __Host-hindama_sesion con HttpOnly, Secure, SameSite=Lax y Path=/", () => {
    const collector = new SetCookieCollector();
    writeSession(collector, session(), KEY, noCookies);
    expect(collector.values).toHaveLength(1);
    const [cookie] = collector.values;
    expect(cookie.startsWith("__Host-hindama_sesion=")).toBe(true);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain=");
  });

  it("divide en .0, .1… si el valor supera 4 KB y lo vuelve a unir", () => {
    const big = session({ accessToken: "a".repeat(6000) });
    const collector = new SetCookieCollector();
    writeSession(collector, big, KEY, parseCookieHeader("__Host-hindama_sesion=viejo"));

    const names = collector.values.map((c) => c.split("=")[0]);
    expect(names).toEqual([
      "__Host-hindama_sesion.0",
      "__Host-hindama_sesion.1",
      "__Host-hindama_sesion.2",
      "__Host-hindama_sesion",
    ]);
    // La cookie única anterior se borra.
    expect(collector.values.at(-1)).toContain("Max-Age=0");
    for (const value of collector.values.slice(0, -1)) {
      expect(value.split(";")[0].length).toBeLessThan(4096);
    }
    expect(readSession(parseCookieHeader(cookieHeader(collector)), KEY)).toEqual(big);
    expect(CHUNK_SIZE).toBeLessThan(4096);
  });

  it("al volver a una sola cookie borra los fragmentos que sobran", () => {
    const collector = new SetCookieCollector();
    writeSession(
      collector,
      session(),
      KEY,
      parseCookieHeader("__Host-hindama_sesion.0=a; __Host-hindama_sesion.1=b; otra=1"),
    );
    expect(collector.values.map((c) => c.split("=")[0])).toEqual([
      "__Host-hindama_sesion",
      "__Host-hindama_sesion.0",
      "__Host-hindama_sesion.1",
    ]);
  });

  it("cerrar sesión borra la cookie y todos sus fragmentos", () => {
    const collector = new SetCookieCollector();
    clearSession(
      collector,
      parseCookieHeader("__Host-hindama_sesion.0=a; __Host-hindama_sesion.1=b"),
    );
    expect(collector.values).toHaveLength(3);
    expect(collector.values.every((c) => c.includes("Max-Age=0"))).toBe(true);
  });

  it("la llave debe tener 32 bytes", () => {
    expect(parseSessionKey(randomBytes(32).toString("base64"))).toHaveLength(32);
    expect(() => parseSessionKey(randomBytes(16).toString("base64"))).toThrow();
  });
});
