"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { meSchema, termsAcceptanceSchema } from "@/lib/api/schemas/account";
import {
  projectCreateSchema,
  projectPageSchema,
  projectSchema,
  projectUpdateSchema,
  type Project,
  type ProjectCreate,
  type ProjectUpdate,
} from "@/lib/api/schemas/projects";
import { isUuid } from "@/lib/api/zod";
import { ApiError, type HttpClient } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { ME_KEY } from "@/lib/query/provider";

export const PROJECTS_KEY = ["projects"] as const;
export const projectKey = (id: string) => [...PROJECTS_KEY, "detail", id] as const;

/** Ruta del BFF de un proyecto. Un id que no es UUID no puede existir: 404 sin pedirlo (RN-02). */
export function projectPath(id: string): string {
  if (!isUuid(id)) throw new ApiError({ status: 404, code: "resource.not_found" });
  return `/projects/${encodeURIComponent(id)}`;
}

export type ProjectSort =
  "-created_at" | "created_at" | "name" | "-name" | "last_run_at" | "-last_run_at";

/** `listProjects` (V-13): una página con el orden que pide la vista; la API pagina y ordena. */
export function useProjectList({
  page,
  pageSize,
  sort,
}: {
  page: number;
  pageSize: number;
  sort: ProjectSort;
}) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...PROJECTS_KEY, "list", { page, pageSize, sort }],
    queryFn: async ({ signal }) =>
      (
        await http.read("/projects", projectPageSchema, {
          query: { page, page_size: pageSize, sort },
          signal,
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

/** `getProject` (V-16, V-17 y el marco de las vistas del proyecto). */
export function useProject(id: string) {
  const http = useHttpClient();
  return useQuery({
    queryKey: projectKey(id),
    queryFn: async ({ signal }) =>
      (await http.read(projectPath(id), projectSchema, { signal })).data,
    retry: false,
  });
}

/** `createProject` (V-15). Devuelve el proyecto creado y sus avisos (`url.no_tls`…). */
export async function createProject(http: HttpClient, input: ProjectCreate) {
  const body = projectCreateSchema.parse(input);
  return http.post<Project>("/projects", { body, schema: projectSchema });
}

/** `updateProject` (V-17). Si cambia el host, la API devuelve `project.verification_lost`. */
export async function updateProject(http: HttpClient, id: string, input: ProjectUpdate) {
  const body = projectUpdateSchema.parse(input);
  return http.patch<Project>(projectPath(id), { body, schema: projectSchema });
}

/** `deleteProject` (V-17): la confirmación es el nombre tal como lo escribió el analista. */
export async function deleteProject(http: HttpClient, id: string, confirmation: string) {
  await http.delete(projectPath(id), { query: { confirmation } });
}

/** `acceptTerms` (V-14): acepta la versión vigente que informó `getMe`. */
export async function acceptTerms(http: HttpClient, version: string) {
  const body = termsAcceptanceSchema.parse({ version });
  return http.post("/me/terms", { body, schema: meSchema });
}

/** Vuelve a pedir las listas y el proyecto tras un cambio (mutación con refresco). */
export function useRefreshProjects() {
  const client = useQueryClient();
  return {
    projects: () => client.invalidateQueries({ queryKey: PROJECTS_KEY }),
    me: () => client.invalidateQueries({ queryKey: ME_KEY }),
    setProject: (project: Project) => client.setQueryData(projectKey(project.id), project),
    removeProject: (id: string) => client.removeQueries({ queryKey: projectKey(id) }),
  };
}
