import { cn } from "@/lib/cn";

const STYLE: Record<string, string> = {
  GET: "bg-success-bg text-success",
  POST: "bg-progress-bg text-progress",
  PUT: "bg-warning-bg text-warning",
  PATCH: "bg-warning-bg text-warning",
  DELETE: "bg-danger-bg text-danger",
};

/** Método HTTP en una etiqueta monoespaciada; el color solo refuerza, el texto siempre está. */
export function MethodBadge({ method, className }: { method: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-16 flex-none items-center justify-center rounded-[10px] px-2 py-[5px] font-mono text-[12.5px] font-semibold",
        STYLE[method] ?? "bg-info-bg text-info",
        className,
      )}
    >
      {method}
    </span>
  );
}
