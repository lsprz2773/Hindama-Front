import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `getAdminStats` (V-33): estadísticas anónimas de la plataforma, solo para el administrador. */
export const GET = apiRoute(SPECS.getAdminStats);
