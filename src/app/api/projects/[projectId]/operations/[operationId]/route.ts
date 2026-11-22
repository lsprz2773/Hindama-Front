import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `updateOperation` (V-24): política, campo de propietario y parámetros de recurso. */
export const PATCH = apiRoute(SPECS.updateOperation);
