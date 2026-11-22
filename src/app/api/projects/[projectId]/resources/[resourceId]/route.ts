import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `updateResource` (V-23): confirmar o editar un recurso. */
export const PATCH = apiRoute(SPECS.updateResource);

/** `deleteResource` (V-23). */
export const DELETE = apiRoute(SPECS.deleteResource);
