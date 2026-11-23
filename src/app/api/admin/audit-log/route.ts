import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `listAuditLog` (V-34): bitácora de acciones sensibles, solo para el administrador (RF-84). */
export const GET = apiRoute(SPECS.listAuditLog);
