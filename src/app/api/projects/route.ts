import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `listProjects` (V-13): página de proyectos del analista. */
export const GET = apiRoute(SPECS.listProjects);

/** `createProject` (V-15). */
export const POST = apiRoute(SPECS.createProject);
