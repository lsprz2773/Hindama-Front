/**
 * Comprueba que los tipos de `src/lib/api/schema.d.ts` corresponden al contrato 0.6.0
 * (`contract/openapi.yaml`, copia de `hindama-docs/03-api/openapi.yaml`, commit 09ac5c9).
 * Falla si el contrato no es la versión fijada o si los tipos generados no coinciden.
 * Uso: `npm run contract:check` (corre antes de `npm test`). Para regenerar: `npm run contract:types`.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXPECTED_VERSION = "0.6.0";
const EXPECTED_SHA256 = "7d52cca44763ff4251eea3785bc112ff9586a64c37691581f21e42fd0ff4fc6a";
const CONTRACT = "contract/openapi.yaml";
const TYPES = "src/lib/api/schema.d.ts";

const fail = (message) => {
  console.error(`[contract:check] ${message}`);
  process.exit(1);
};

const contract = readFileSync(CONTRACT);
const version = /^info:\n(?:  .*\n)*?  version: (\S+)/m.exec(contract.toString("utf8"))?.[1];
if (version !== EXPECTED_VERSION)
  fail(`El contrato es la versión ${version}, se esperaba ${EXPECTED_VERSION}.`);
const sha = createHash("sha256").update(contract).digest("hex");
if (sha !== EXPECTED_SHA256)
  fail(`${CONTRACT} no es la copia fijada del contrato ${EXPECTED_VERSION}.`);

const dir = mkdtempSync(join(tmpdir(), "contract-"));
try {
  const out = join(dir, "schema.d.ts");
  execFileSync(
    process.execPath,
    ["node_modules/openapi-typescript/bin/cli.js", CONTRACT, "-o", out],
    {
      stdio: "ignore",
    },
  );
  if (readFileSync(out, "utf8") !== readFileSync(TYPES, "utf8")) {
    fail(`${TYPES} no coincide con ${CONTRACT}. Ejecuta \`npm run contract:types\`.`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`[contract:check] Tipos al día con el contrato ${EXPECTED_VERSION}.`);
