import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `updateIdentity` (V-22): una credencial nueva reemplaza la anterior. */
export const PATCH = apiRoute(SPECS.updateIdentity);

/** `deleteIdentity` (V-21). */
export const DELETE = apiRoute(SPECS.deleteIdentity);
