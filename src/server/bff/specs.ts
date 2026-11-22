import { meSchema, termsAcceptanceSchema } from "@/lib/api/schemas/account";
import {
  deleteProjectQuerySchema,
  listProjectsQuerySchema,
  projectCreateSchema,
  projectPageSchema,
  projectSchema,
  projectUpdateSchema,
} from "@/lib/api/schemas/projects";
import { verificationRequestSchema, verificationSchema } from "@/lib/api/schemas/verification";
import {
  contractPageSchema,
  contractVersionSchema,
  listContractsQuerySchema,
  listOperationsQuerySchema,
  operationPageSchema,
  operationSchema,
  operationUpdateSchema,
  policyBulkResultSchema,
  policyBulkUpdateSchema,
} from "@/lib/api/schemas/contracts";
import { CONTRACT_FORM_MAX_BYTES, validateContractImport } from "./contract-import";
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
  getVerification: { path: [...project, "verification"], response: verificationSchema },
  verifyOwnership: {
    path: [...project, "verification"],
    body: verificationRequestSchema,
    response: verificationSchema,
  },
  listContracts: {
    path: [...project, "contracts"],
    query: listContractsQuerySchema,
    response: contractPageSchema,
  },
  importContract: {
    path: [...project, "contracts"],
    multipart: validateContractImport,
    maxBodyBytes: CONTRACT_FORM_MAX_BYTES,
    response: contractVersionSchema,
  },
  getContract: {
    path: [...project, "contracts", { param: "contractId" }],
    response: contractVersionSchema,
  },
  listOperations: {
    path: [...project, "operations"],
    query: listOperationsQuerySchema,
    response: operationPageSchema,
  },
  updateOperation: {
    path: [...project, "operations", { param: "operationId" }],
    body: operationUpdateSchema,
    response: operationSchema,
  },
  applyPolicy: {
    path: [...project, "policy"],
    body: policyBulkUpdateSchema,
    response: policyBulkResultSchema,
  },
} satisfies Record<string, ApiRouteSpec>;
