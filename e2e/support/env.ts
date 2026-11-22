/**
 * Entorno de las pruebas e2e. El BFF habla con el simulador del contrato (Prism, puerto 4010)
 * en lugar de la API real, y Cognito nunca se llama: las pantallas de acceso se prueban con
 * respuestas simuladas del BFF que respetan sus códigos. Los valores son solo de prueba.
 */
export const E2E_ORIGIN = "http://localhost:3000";
export const E2E_API_URL = "http://127.0.0.1:4010";
/** Llave AES-256 de prueba (32 bytes en base64). No es la de ningún entorno real. */
export const E2E_SESSION_KEY = Buffer.alloc(32, 7).toString("base64");
export const E2E_CSRF = "e2e-csrf-token";

export const E2E_SERVER_ENV = {
  HINDAMA_API_URL: E2E_API_URL,
  HINDAMA_PUBLIC_ORIGIN: E2E_ORIGIN,
  HINDAMA_SESSION_KEY: E2E_SESSION_KEY,
  COGNITO_REGION: "us-east-1",
  COGNITO_CLIENT_ID: "e2e-client",
  COGNITO_CLIENT_SECRET: "e2e-client-secret",
};
