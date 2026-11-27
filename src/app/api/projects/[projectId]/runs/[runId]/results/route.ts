import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `listRunResults` (V-28): celdas de la matriz. */
export const GET = apiRoute(SPECS.listRunResults);
