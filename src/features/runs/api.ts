"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  dismissalCreateSchema,
  findingOccurrencePageSchema,
  findingPageSchema,
  findingSchema,
  type DismissalCreate,
  type Finding,
  type FindingStatus,
  type Severity,
} from "@/lib/api/schemas/findings";
import {
  resultPageSchema,
  runCreateSchema,
  runPageSchema,
  runProgressSchema,
  runRerunSchema,
  runSchema,
  type Run,
  type RunCreate,
  type RunProgress,
  type RunRerun,
} from "@/lib/api/schemas/runs";
import type { Project } from "@/lib/api/schemas/projects";
import type { Schemas } from "@/lib/api/types";
import type { HttpClient } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { PROJECTS_KEY, projectKey, projectPath } from "@/features/projects/api";

type Module = Schemas["Module"];
type RunSummary = Schemas["RunSummary"];
type RunStatus = Schemas["RunStatus"];
type Verdict = Schemas["Verdict"];

/** Consultas de ejecuciones y hallazgos (fase 5), colgadas de la clave del proyecto. */
export const runsKey = (id: string) => [...projectKey(id), "runs"] as const;
export const findingsKey = (id: string) => [...projectKey(id), "findings"] as const;

const runPath = (id: string, runId: string) =>
  `${projectPath(id)}/runs/${encodeURIComponent(runId)}`;
const findingPath = (id: string, findingId: string) =>
  `${projectPath(id)}/findings/${encodeURIComponent(findingId)}`;

/** `listRuns` (V-31): de la más reciente a la más antigua. */
export function useRuns(
  id: string,
  { page = 1, pageSize = 20, status }: { page?: number; pageSize?: number; status?: RunStatus[] },
) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...runsKey(id), "list", { page, pageSize, status }],
    queryFn: async ({ signal }) =>
      (
        await http.read(`${projectPath(id)}/runs`, runPageSchema, {
          query: { page, page_size: pageSize, status },
          signal,
        })
      ).data,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** `getRun` (V-26, V-27). */
export function useRun(id: string, runId: string | null) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...runsKey(id), "detail", runId],
    queryFn: async ({ signal }) =>
      (await http.read(runPath(id, runId as string), runSchema, { signal })).data,
    enabled: runId !== null,
    retry: false,
  });
}

/** `createRun` (V-25): 202 con la ejecución en cola. */
export async function createRun(http: HttpClient, id: string, input: RunCreate) {
  const body = runCreateSchema.parse(input);
  return (await http.post<Run>(`${projectPath(id)}/runs`, { body, schema: runSchema })).data;
}

/** `rerunRun` (V-16, V-27): la confirmación de riesgo se pide de nuevo en cada ejecución. */
export async function rerunRun(http: HttpClient, id: string, runId: string, input: RunRerun) {
  const body = runRerunSchema.parse(input);
  return (await http.post<Run>(`${runPath(id, runId)}/rerun`, { body, schema: runSchema })).data;
}

/** `cancelRun` (V-26): sin cuerpo; repetirla mientras se detiene responde lo mismo. */
export async function cancelRun(http: HttpClient, id: string, runId: string) {
  return (await http.post<Run>(`${runPath(id, runId)}/cancel`, { schema: runSchema })).data;
}

function toSummary(run: Run): RunSummary {
  return {
    id: run.id,
    number: run.number,
    status: run.status,
    end_reason: run.end_reason,
    modules: run.modules,
    requests_sent: run.progress.requests_sent,
    findings_by_severity: run.progress.findings_by_severity,
    created_at: run.created_at,
    started_at: run.started_at,
    finished_at: run.finished_at,
  };
}

/** Tras crear, repetir o cancelar: el proyecto (`last_run`) y las ejecuciones. */
export function useAfterRun(id: string) {
  const client = useQueryClient();
  return (run?: Run) => {
    if (run) {
      client.setQueryData([...runsKey(id), "detail", run.id], run);
      // `last_run` del proyecto al instante, para que V-26 la encuentre antes de recargarlo.
      client.setQueryData<Project>(projectKey(id), (project) =>
        project && (!project.last_run || project.last_run.number <= run.number)
          ? { ...project, last_run: toSummary(run) }
          : project,
      );
    }
    void client.invalidateQueries({ queryKey: projectKey(id), exact: true });
    void client.invalidateQueries({ queryKey: runsKey(id) });
    void client.invalidateQueries({ queryKey: [...PROJECTS_KEY, "list"] });
  };
}

export type RunStream =
  | { state: "connecting" }
  | { state: "open"; run: Run }
  | { state: "ended"; run: Run }
  | { state: "error" };

function parseEvent<T>(
  schema: { safeParse(v: unknown): { success: boolean; data?: T } },
  raw: string,
) {
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? (result.data as T) : null;
  } catch {
    return null;
  }
}

/**
 * Progreso en vivo (`streamRunEvents` por el BFF, ADR-006). `snapshot` trae la ejecución entera,
 * `progress` solo su progreso y `end` la ejecución terminada; entonces se cierra el stream. Un
 * evento que no cumple el contrato se descarta. `EventSource` reconecta solo con `Last-Event-ID`
 * cuando el servidor cierra a los 15 minutos.
 */
export function useRunStream(id: string, runId: string | null, initial: Run | undefined) {
  const client = useQueryClient();
  const [stream, setStream] = useState<RunStream>({ state: "connecting" });
  const active = initial ? initial.status === "queued" || initial.status === "running" : false;

  useEffect(() => {
    if (!runId || !active) return;
    const source = new EventSource(`/api${runPath(id, runId)}/progress`);
    let current: Run | null = null;
    const put = (run: Run, state: "open" | "ended") => {
      current = run;
      client.setQueryData([...runsKey(id), "detail", runId], run);
      setStream({ state, run });
    };
    source.addEventListener("snapshot", (event) => {
      const run = parseEvent<Run>(runSchema, (event as MessageEvent<string>).data);
      if (run) put(run, "open");
    });
    source.addEventListener("progress", (event) => {
      const progress = parseEvent<RunProgress>(
        runProgressSchema,
        (event as MessageEvent<string>).data,
      );
      if (progress && current) put({ ...current, status: progress.status, progress }, "open");
    });
    source.addEventListener("end", (event) => {
      const run = parseEvent<Run>(runSchema, (event as MessageEvent<string>).data);
      source.close();
      if (run) put(run, "ended");
      void client.invalidateQueries({ queryKey: projectKey(id), exact: true });
      void client.invalidateQueries({ queryKey: runsKey(id) });
      void client.invalidateQueries({ queryKey: findingsKey(id) });
    });
    source.onerror = () => {
      // Cerrado por el servidor: `EventSource` reconecta solo. Cerrado del todo: error.
      if (source.readyState === EventSource.CLOSED) setStream({ state: "error" });
    };
    return () => source.close();
  }, [client, id, runId, active]);

  return stream;
}

/** `listRunResults` (V-28): hasta 500 celdas por página. */
export function useRunResults(
  id: string,
  runId: string,
  {
    page = 1,
    pageSize = 500,
    module,
    verdict,
  }: { page?: number; pageSize?: number; module?: Module[]; verdict?: Verdict[] },
) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...runsKey(id), "results", runId, { page, pageSize, module, verdict }],
    queryFn: async ({ signal }) =>
      (
        await http.read(`${runPath(id, runId)}/results`, resultPageSchema, {
          query: { page, page_size: pageSize, module, verdict },
          signal,
        })
      ).data,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export interface FindingFilters {
  page?: number;
  pageSize?: number;
  module?: Module[];
  severity?: Severity[];
  status?: FindingStatus[];
  runId?: string;
  /** `false` deja la consulta sin pedir (p. ej. mientras no aplica). */
  enabled?: boolean;
}

/** `listFindings` (V-27, V-29, V-31): por severidad y luego la detección más reciente. */
export function useFindings(
  id: string,
  { page = 1, pageSize = 20, module, severity, status, runId, enabled = true }: FindingFilters,
) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...findingsKey(id), "list", { page, pageSize, module, severity, status, runId }],
    queryFn: async ({ signal }) =>
      (
        await http.read(`${projectPath(id)}/findings`, findingPageSchema, {
          query: { page, page_size: pageSize, module, severity, status, run_id: runId },
          signal,
        })
      ).data,
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** `getFinding` (V-30). */
export function useFinding(id: string, findingId: string) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...findingsKey(id), "detail", findingId],
    queryFn: async ({ signal }) =>
      (await http.read(findingPath(id, findingId), findingSchema, { signal })).data,
    retry: false,
  });
}

/** `listFindingOccurrences` (V-30): hasta 20 por página, la más reciente primero. */
export function useOccurrences(id: string, findingId: string, page: number, pageSize = 10) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [...findingsKey(id), "occurrences", findingId, { page, pageSize }],
    queryFn: async ({ signal }) =>
      (
        await http.read(`${findingPath(id, findingId)}/occurrences`, findingOccurrencePageSchema, {
          query: { page, page_size: pageSize },
          signal,
        })
      ).data,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** `dismissFinding` (V-30, C-09). */
export async function dismissFinding(
  http: HttpClient,
  id: string,
  findingId: string,
  input: DismissalCreate,
) {
  const body = dismissalCreateSchema.parse(input);
  return (
    await http.post<Finding>(`${findingPath(id, findingId)}/dismissal`, {
      body,
      schema: findingSchema,
    })
  ).data;
}

/** `revertDismissal` (V-30, C-09): vuelve a `persistent`. */
export async function revertDismissal(http: HttpClient, id: string, findingId: string) {
  await http.delete(`${findingPath(id, findingId)}/dismissal`);
}

/** Tras aceptar o revertir: el hallazgo, las listas y el proyecto (conteos y «concluido»). */
export function useAfterFinding(id: string) {
  const client = useQueryClient();
  return (finding?: Finding) => {
    if (finding) client.setQueryData([...findingsKey(id), "detail", finding.id], finding);
    void client.invalidateQueries({ queryKey: findingsKey(id) });
    void client.invalidateQueries({ queryKey: projectKey(id), exact: true });
  };
}
