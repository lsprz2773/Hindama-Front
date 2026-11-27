import { useTranslations } from "next-intl";
import { truncateBytes } from "@/lib/truncate";

interface HttpViewerProps {
  /** Encabezado del bloque: «Petición», «Respuesta · 200 OK». */
  title: string;
  /** Nota a la derecha del encabezado (p. ej. «Credencial enmascarada»). */
  note?: string;
  /** Cabeceras y cuerpo ya enmascarados por la API. Se muestran siempre escapados. */
  content: string;
}

/**
 * C-12. Visor de cabeceras y cuerpo de una petición o respuesta: monoespaciado, con aviso de
 * recorte a partir de 10 KB. El contenido viene de la API del analista y nunca se interpreta.
 */
export function HttpViewer({ title, note, content }: HttpViewerProps) {
  const t = useTranslations("HttpViewer");
  const view = truncateBytes(content);
  const kb = (view.bytes / 1024).toFixed(1);

  return (
    <figure className="border-line bg-code-bg m-0 min-w-0 overflow-hidden rounded-[20px] border">
      <figcaption className="border-line flex flex-wrap justify-between gap-3 border-b px-[18px] py-3 text-sm">
        <b className="font-semibold">{title}</b>
        <span className="text-muted">
          {note}
          {view.truncated ? (note ? " · " : "") + t("truncated", { kb }) : null}
        </span>
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={title}
        className="text-fg m-0 overflow-x-auto p-[18px] font-mono text-[13.5px] leading-[1.65]"
      >
        {view.text}
      </pre>
    </figure>
  );
}
