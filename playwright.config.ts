import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGIN, E2E_SERVER_ENV } from "./e2e/support/env";

/**
 * Las e2e corren contra el simulador del contrato (Prism con `contract/openapi.yaml`), que el BFF
 * usa como API base; nunca contra el backend real. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permite usar
 * un Chromium ya instalado en la máquina.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 60_000,
  // El servidor de desarrollo compila cada ruta la primera vez que se visita.
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: E2E_ORIGIN,
    trace: "off",
    // Español como idioma del navegador: el idioma principal no lleva prefijo en la ruta.
    locale: "es-MX",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run mock:api",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      url: E2E_ORIGIN,
      reuseExistingServer: true,
      timeout: 120_000,
      env: E2E_SERVER_ENV,
    },
  ],
});
