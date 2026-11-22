import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `getVerification` (V-18): código, host e instrucciones de cada método. */
export const GET = apiRoute(SPECS.getVerification);

/** `verifyOwnership` (V-18): síncrona, hasta 20 s. Un 422 trae `found`. */
export const POST = apiRoute(SPECS.verifyOwnership);
