import { meSchema, termsAcceptanceSchema } from "@/lib/api/schemas/account";
import {
  deleteProjectQuerySchema,
  listProjectsQuerySchema,
  projectCreateSchema,
  projectPageSchema,
  projectSchema,
  projectUpdateSchema,
} from "@/lib/api/schemas/projects";
import type { ApiRouteSpec } from "./route";

/**
 * Operaciones del contrato que expone el BFF, con su ruta fija, consulta, cuerpo y respuesta.
 * Los route handlers de `src/app/api` solo las enlazan; aquí se prueban sin Next.
 */
const project = ["projects", { param: "projectId" }] as const;

export const SPECS = {
  getMe: { path: ["me"], response: meSchema },
  acceptTerms: { path: ["me", "terms"], body: termsAcceptanceSchema, response: meSchema },
  listProjects: { path: ["projects"], query: listProjectsQuerySchema, response: projectPageSchema },
  createProject: { path: ["projects"], body: projectCreateSchema, response: projectSchema },
  getProject: { path: project, response: projectSchema },
  updateProject: { path: project, body: projectUpdateSchema, response: projectSchema },
  deleteProject: { path: project, query: deleteProjectQuerySchema },
} satisfies Record<string, ApiRouteSpec>;
