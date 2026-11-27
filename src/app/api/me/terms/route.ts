import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `acceptTerms` (V-14): registra la versión aceptada de los términos. */
export const POST = apiRoute(SPECS.acceptTerms);
