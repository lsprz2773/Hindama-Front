import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `discoverResources` (V-23): síncrona, hasta 25 s; los recursos nuevos quedan sin confirmar. */
export const POST = apiRoute(SPECS.discoverResources);
