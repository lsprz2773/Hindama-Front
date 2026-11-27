import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `getContract` (V-20): una versión con sus avisos y cambios. */
export const GET = apiRoute(SPECS.getContract);
