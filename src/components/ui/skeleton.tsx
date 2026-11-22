"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/** Bloque de esqueleto: una pista con un barrido de luz. Siempre decorativo (`aria-hidden`). */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("skeleton block rounded-lg", className)} />;
}

const WIDTHS = ["w-full", "w-[92%]", "w-[78%]", "w-[86%]", "w-[64%]"];

/** Varias líneas de texto con anchos distintos, como un párrafo real. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3", WIDTHS[i % WIDTHS.length])} />
      ))}
    </span>
  );
}

/** Tarjeta de cristal con el mismo marco que las reales, para que no salte el diseño al cargar. */
export function SkeletonCard({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Cifra grande con su etiqueta (indicadores y estadísticas). */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "border-line bg-panel flex flex-col gap-2.5 rounded-[24px] border p-5",
        className,
      )}
    >
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

/** Filas de una tabla o lista: icono, dos líneas y una insignia. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="border-line bg-panel-2 flex items-center gap-4 rounded-[18px] border px-4 py-3.5"
        >
          <Skeleton className="size-10 flex-none rounded-xl" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </span>
          <Skeleton className="h-6 w-20 flex-none rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Zona de gráfica: barras de alturas distintas sobre una línea base. */
export function SkeletonChart({ className }: { className?: string }) {
  const heights = ["h-[45%]", "h-[70%]", "h-[55%]", "h-[85%]", "h-[62%]", "h-[92%]"];
  return (
    <div
      aria-hidden="true"
      className={cn("border-line-strong flex h-[220px] items-end gap-6 border-b px-2", className)}
    >
      {heights.map((h, i) => (
        <Skeleton key={i} className={cn("w-full rounded-b-none", h)} />
      ))}
    </div>
  );
}

/**
 * Región de carga accesible: anuncia «Cargando…» a los lectores de pantalla y marca el bloque
 * como ocupado. Los esqueletos de dentro son decorativos.
 */
export function SkeletonRegion({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("Loading");
  const text = label ?? t("label");
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={text}
      className={cn("animate-fade-in", className)}
    >
      <span className="sr-only">{text}</span>
      {children}
    </div>
  );
}
