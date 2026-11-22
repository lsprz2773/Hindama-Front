import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `listRuns` (V-16, V-31), filtrable por estado. */
export const GET = apiRoute(SPECS.listRuns);
/** `createRun` (V-25): responde 202 con la ejecución en cola. */
export const POST = apiRoute(SPECS.createRun);
