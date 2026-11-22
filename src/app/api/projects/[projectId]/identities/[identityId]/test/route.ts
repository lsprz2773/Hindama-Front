import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `testIdentity` (V-21, V-22): síncrona, hasta 20 s; nunca devuelve la credencial. */
export const POST = apiRoute(SPECS.testIdentity);
