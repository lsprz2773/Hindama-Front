import { apiPath, getDeps, proxyToApi } from "@/server/bff";

/**
 * Progreso de una ejecución por SSE (ADR-006, guía del frontend sección 5.8). El navegador abre
 * `new EventSource('/api/projects/{pid}/runs/{rid}/progress')`; este handler agrega el Bearer y
 * retransmite `GET /projects/{pid}/runs/{rid}/events` sin búfer. Al cerrar el navegador su
 * conexión se aborta la de la API. La API cierra el stream a los 15 minutos y `EventSource`
 * reconecta con `Last-Event-ID`.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/runs/[runId]/progress">,
) {
  const { projectId, runId } = await ctx.params;
  return proxyToApi(
    request,
    apiPath("projects", projectId, "runs", runId, "events"),
    await getDeps(),
    { stream: true },
  );
}
