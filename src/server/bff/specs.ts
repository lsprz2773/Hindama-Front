import { meSchema, termsAcceptanceSchema } from "@/lib/api/schemas/account";
import {
  adminStatsSchema,
  auditLogPageSchema,
  getAdminStatsQuerySchema,
  listAuditLogQuerySchema,
} from "@/lib/api/schemas/admin";
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
import {
  identityCreateSchema,
  identityPageSchema,
  identitySchema,
  identityTestRequestSchema,
  identityTestSchema,
  identityUpdateSchema,
  listIdentitiesQuerySchema,
} from "@/lib/api/schemas/identities";
import {
  listResourcesQuerySchema,
  resourceCreateSchema,
  resourceDiscoveryRequestSchema,
  resourceDiscoverySchema,
  resourcePageSchema,
  resourceSchema,
  resourceUpdateSchema,
} from "@/lib/api/schemas/resources";
import {
  listRunResultsQuerySchema,
  listRunsQuerySchema,
  resultPageSchema,
  runCreateSchema,
  runPageSchema,
  runRerunSchema,
  runSchema,
} from "@/lib/api/schemas/runs";
import {
  dismissalCreateSchema,
  findingOccurrencePageSchema,
  findingPageSchema,
  findingSchema,
  listFindingsQuerySchema,
  listOccurrencesQuerySchema,
} from "@/lib/api/schemas/findings";
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
  listIdentities: {
    path: [...project, "identities"],
    query: listIdentitiesQuerySchema,
    response: identityPageSchema,
  },
  // La credencial va en el cuerpo de ida y nunca vuelve: la respuesta solo trae el sufijo.
  createIdentity: {
    path: [...project, "identities"],
    body: identityCreateSchema,
    response: identitySchema,
    maxBodyBytes: 32 * 1024,
  },
  updateIdentity: {
    path: [...project, "identities", { param: "identityId" }],
    body: identityUpdateSchema,
    response: identitySchema,
    maxBodyBytes: 32 * 1024,
  },
  deleteIdentity: { path: [...project, "identities", { param: "identityId" }] },
  testIdentity: {
    path: [...project, "identities", { param: "identityId" }, "test"],
    body: identityTestRequestSchema,
    response: identityTestSchema,
  },
  applyPolicy: {
    path: [...project, "policy"],
    body: policyBulkUpdateSchema,
    response: policyBulkResultSchema,
  },
  listResources: {
    path: [...project, "resources"],
    query: listResourcesQuerySchema,
    response: resourcePageSchema,
  },
  createResource: {
    path: [...project, "resources"],
    body: resourceCreateSchema,
    response: resourceSchema,
  },
  // Síncrona (hasta 25 s). El cuerpo es opcional en el contrato; el cliente siempre envía `{}`.
  discoverResources: {
    path: [...project, "resources", "discovery"],
    body: resourceDiscoveryRequestSchema,
    response: resourceDiscoverySchema,
  },
  updateResource: {
    path: [...project, "resources", { param: "resourceId" }],
    body: resourceUpdateSchema,
    response: resourceSchema,
  },
  deleteResource: { path: [...project, "resources", { param: "resourceId" }] },
  listRuns: {
    path: [...project, "runs"],
    query: listRunsQuerySchema,
    response: runPageSchema,
  },
  createRun: {
    path: [...project, "runs"],
    body: runCreateSchema,
    response: runSchema,
    maxBodyBytes: 4 * 1024,
  },
  getRun: { path: [...project, "runs", { param: "runId" }], response: runSchema },
  cancelRun: { path: [...project, "runs", { param: "runId" }, "cancel"], response: runSchema },
  rerunRun: {
    path: [...project, "runs", { param: "runId" }, "rerun"],
    body: runRerunSchema,
    response: runSchema,
    maxBodyBytes: 1024,
  },
  listRunResults: {
    path: [...project, "runs", { param: "runId" }, "results"],
    query: listRunResultsQuerySchema,
    response: resultPageSchema,
  },
  listFindings: {
    path: [...project, "findings"],
    query: listFindingsQuerySchema,
    response: findingPageSchema,
  },
  getFinding: { path: [...project, "findings", { param: "findingId" }], response: findingSchema },
  listFindingOccurrences: {
    path: [...project, "findings", { param: "findingId" }, "occurrences"],
    query: listOccurrencesQuerySchema,
    response: findingOccurrencePageSchema,
  },
  dismissFinding: {
    path: [...project, "findings", { param: "findingId" }, "dismissal"],
    body: dismissalCreateSchema,
    response: findingSchema,
    maxBodyBytes: 16 * 1024,
  },
  revertDismissal: { path: [...project, "findings", { param: "findingId" }, "dismissal"] },
  // Solo el administrador (la API responde 403 a un analista). Nunca devuelve hosts ni credenciales.
  listAuditLog: {
    path: ["admin", "audit-log"],
    query: listAuditLogQuerySchema,
    response: auditLogPageSchema,
  },
  // Solo el administrador (403 `role.forbidden` al analista). Cifras anónimas, nunca un proyecto.
  getAdminStats: {
    path: ["admin", "stats"],
    query: getAdminStatsQuerySchema,
    response: adminStatsSchema,
  },
} satisfies Record<string, ApiRouteSpec>;
