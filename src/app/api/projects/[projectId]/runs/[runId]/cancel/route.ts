import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `cancelRun` (V-26), sin cuerpo. */
export const POST = apiRoute(SPECS.cancelRun);
