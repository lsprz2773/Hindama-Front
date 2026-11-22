import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `listFindings` (V-27, V-29). */
export const GET = apiRoute(SPECS.listFindings);
