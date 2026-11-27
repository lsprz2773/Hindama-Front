import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `listResources` (V-23), filtrable por identidad y tipo. */
export const GET = apiRoute(SPECS.listResources);

/** `createResource` (V-23): un recurso agregado a mano queda confirmado. */
export const POST = apiRoute(SPECS.createResource);
