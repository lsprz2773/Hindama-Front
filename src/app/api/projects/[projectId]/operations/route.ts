import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `listOperations` (V-19, V-24). */
export const GET = apiRoute(SPECS.listOperations);
