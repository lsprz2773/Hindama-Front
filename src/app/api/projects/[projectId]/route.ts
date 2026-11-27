import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `getProject` (V-16, V-17 y el marco de las vistas del proyecto). */
export const GET = apiRoute(SPECS.getProject);

/** `updateProject` (V-17). */
export const PATCH = apiRoute(SPECS.updateProject);

/** `deleteProject` (V-17): la confirmación es el nombre exacto del proyecto. */
export const DELETE = apiRoute(SPECS.deleteProject);
