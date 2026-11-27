import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `dismissFinding` (V-30, C-09): aceptar el riesgo o marcar como falso positivo. */
export const POST = apiRoute(SPECS.dismissFinding);
/** `revertDismissal` (V-30, C-09). */
export const DELETE = apiRoute(SPECS.revertDismissal);
