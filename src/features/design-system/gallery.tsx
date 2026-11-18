"use client";

import { useState, type ReactNode } from "react";
import { AcceptRiskDialog } from "@/components/dialogs/accept-risk-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { DeleteDialog } from "@/components/dialogs/delete-dialog";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/ui/language-selector";
import { PendingResources } from "@/components/ui/pending-resources";
import { SeverityBadge, SEVERITIES } from "@/components/ui/severity";
import {
  BlockedAction,
  EmptyState,
  ForbiddenState,
  ListSkeleton,
  LoadErrorState,
  NoResultsState,
  RateLimitedState,
  UnavailableState,
} from "@/components/ui/state-view";
import { StatusBadge, STATUS_TONE } from "@/components/ui/status-badge";
import { useToast, type ToastType } from "@/components/ui/toast";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Galería de componentes comunes de la fase 0. Solo existe en desarrollo (ver la página). */
export function Gallery() {
  const toast = useToast();
  const [dialog, setDialog] = useState<"confirm" | "delete" | "risk" | "fail" | null>(null);
  const [lastRisk, setLastRisk] = useState("");

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <h1 className="font-display text-4xl font-medium tracking-[-0.025em]">Componentes comunes</h1>

      <Section id="ds-severity" title="Severidad (C-04)">
        <div className="flex flex-wrap gap-6">
          {SEVERITIES.map((s) => (
            <SeverityBadge key={s} severity={s} />
          ))}
        </div>
      </Section>

      <Section id="ds-status" title="Estados (C-05)">
        <div className="flex flex-col gap-3">
          {(Object.keys(STATUS_TONE) as (keyof typeof STATUS_TONE)[]).map((kind) => (
            <div key={kind} className="flex flex-wrap items-center gap-2.5" data-kind={kind}>
              <span className="text-muted w-20 text-[13px]">{kind}</span>
              {Object.keys(STATUS_TONE[kind]).map((status) => (
                <StatusBadge key={status} kind={kind} status={status as never} />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section id="ds-toast" title="Toasts (C-19)">
        <div className="flex flex-wrap gap-2.5">
          {(["success", "error", "warning", "info", "progress"] as ToastType[]).map((type) => (
            <Button
              key={type}
              variant="secondary"
              onClick={() =>
                toast.show({
                  type,
                  title: `Toast ${type}`,
                  text: "Texto de apoyo del aviso.",
                  progress: type === "progress" ? 60 : undefined,
                  action: type === "error" ? { label: "Reintentar", onClick: () => {} } : undefined,
                })
              }
            >
              {type}
            </Button>
          ))}
        </div>
      </Section>

      <Section id="ds-modal" title="Modales (C-06, C-07, C-09, C-20)">
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" onClick={() => setDialog("confirm")}>
            Confirmar (C-06)
          </Button>
          <Button variant="secondary" onClick={() => setDialog("delete")}>
            Eliminar con nombre (C-07)
          </Button>
          <Button variant="secondary" onClick={() => setDialog("risk")}>
            Aceptar riesgo (C-09)
          </Button>
          <Button variant="secondary" onClick={() => setDialog("fail")}>
            Con error
          </Button>
        </div>
        {lastRisk ? <p role="status">Decisión guardada: {lastRisk}</p> : null}
        <ConfirmDialog
          open={dialog === "confirm"}
          onOpenChange={(o) => setDialog(o ? "confirm" : null)}
          title="¿Salir sin guardar?"
          description="Tienes cambios sin guardar en la política de acceso. Si sales ahora, se pierden."
          consequences={{
            heading: "Se perdería",
            items: [
              "12 reglas cambiadas en la política de acceso",
              "La propuesta para 3 operaciones nuevas",
            ],
          }}
          cancelLabel="Seguir editando"
          confirmLabel="Salir sin guardar"
          onConfirm={() => wait(500)}
        />
        <ConfirmDialog
          open={dialog === "fail"}
          onOpenChange={(o) => setDialog(o ? "fail" : null)}
          title="Acción que falla"
          description="Siempre devuelve un error para ver el estado interno del modal."
          confirmLabel="Intentar"
          onConfirm={() => Promise.reject(new Error("boom"))}
        />
        <DeleteDialog
          open={dialog === "delete"}
          onOpenChange={(o) => setDialog(o ? "delete" : null)}
          title="Eliminar el proyecto «Tienda API»"
          description="Esta acción no se puede deshacer."
          confirmText="Tienda API"
          consequences={{
            heading: "Se borra",
            items: [
              "El contrato, sus 3 versiones y 4 identidades",
              "Ejecuciones, hallazgos y reportes",
            ],
          }}
          confirmLabel="Eliminar proyecto"
          onConfirm={() => wait(500)}
        />
        <AcceptRiskDialog
          open={dialog === "risk"}
          onOpenChange={(o) => setDialog(o ? "risk" : null)}
          onSubmit={async (d) => {
            await wait(300);
            setLastRisk(`${d.reason} · ${d.justification}`);
          }}
        />
      </Section>

      <Section id="ds-states" title="Estados de página (C-13)">
        <div className="grid gap-4 md:grid-cols-2">
          <ListSkeleton label="Cargando proyectos" rows={2} />
          <EmptyState
            title="Aún no tienes proyectos"
            text="Crea tu primer proyecto para evaluar una API."
            action={{ label: "Crear proyecto", href: "/projects/new" }}
          />
          <EmptyState
            positive
            title="Sin hallazgos abiertos"
            text="La última ejecución no encontró problemas."
          />
          <NoResultsState onClear={() => {}} />
          <LoadErrorState subject="los proyectos" reference="7F3A-91C2" onRetry={() => {}} />
          <ForbiddenState href="/projects" />
          <RateLimitedState retryAfter={42} onRetry={() => {}} />
          <UnavailableState onRetry={() => {}} />
        </div>
      </Section>

      <Section id="ds-banners" title="Banners y avisos de la API (C-11, C-16)">
        <Banner
          tone="danger"
          title="Credencial vencida: Usuario A"
          action={<a href="#ds-banners">Actualizar credencial</a>}
        >
          Devuelve 401. Los módulos que la usan omitirán sus operaciones.
        </Banner>
        <ApiWarnings
          warnings={[
            { code: "url.no_tls" },
            { code: "url.unresolved" },
            {
              code: "contract.unparsed_element",
              message: "#/paths/~1orders~1{orderId}/get/parameters/2",
            },
            { code: "contract.unchanged" },
          ]}
        />
      </Section>

      <Section id="ds-pending" title="Recursos pendientes de eliminar (C-15)">
        <PendingResources
          resources={[
            {
              operation: "POST /orders",
              location: "/orders/8f21",
              attempts: 3,
              lastError: "Tiempo de espera agotado (504)",
            },
            {
              operation: "POST /users",
              location: "/users/412",
              attempts: 3,
              lastError: "Acceso denegado (403)",
            },
          ]}
        />
      </Section>

      <Section id="ds-blocked" title="Acción bloqueada con motivo">
        <BlockedAction
          label="Prueba completa"
          reason="Falta verificar la propiedad del host."
          linkLabel="Ir a verificación"
          href="/projects/demo/verification"
        />
      </Section>

      <Section id="ds-lang" title="Selector de idioma (C-18)">
        <div className="flex flex-wrap items-center gap-4">
          <LanguageSelector />
          <LanguageSelector variant="segmented" />
        </div>
      </Section>
    </div>
  );
}
