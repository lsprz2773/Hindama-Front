import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `getRun` (V-26, V-27): foto de la ejecución. */
export const GET = apiRoute(SPECS.getRun);
