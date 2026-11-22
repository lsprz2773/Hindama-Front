import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `listIdentities` (V-21). */
export const GET = apiRoute(SPECS.listIdentities);

/** `createIdentity` (V-22): la credencial se reenvía una vez y no se guarda en el BFF. */
export const POST = apiRoute(SPECS.createIdentity);
