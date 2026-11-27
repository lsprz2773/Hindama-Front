import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `getFinding` (V-30). */
export const GET = apiRoute(SPECS.getFinding);
