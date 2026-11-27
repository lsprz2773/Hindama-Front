import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // Los datos del analista (cabeceras, cuerpos, URL de evidencia) se muestran como texto,
    // nunca como HTML (convenciones §5, guía del frontend §5.9).
    rules: { "react/no-danger": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Tipos generados desde el contrato (`npm run contract:types`).
    "src/lib/api/schema.d.ts",
  ]),
]);

export default eslintConfig;
