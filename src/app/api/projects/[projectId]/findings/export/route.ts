import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `exportFindings` (V-27, V-29, V-32): los hallazgos filtrados en un libro de Excel. */
export const GET = apiRoute(SPECS.exportFindings);
