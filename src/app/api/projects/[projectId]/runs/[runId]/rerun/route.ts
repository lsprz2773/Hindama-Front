import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `rerunRun` (V-16, V-27): la confirmación de riesgo se pide en cada ejecución. */
export const POST = apiRoute(SPECS.rerunRun);
