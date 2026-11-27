import type { ReactNode } from "react";
import { PublicShell } from "@/components/layout/public-shell";
import { Icon } from "@/components/ui/icon";
import { LegalToc } from "./legal-toc";

export interface LegalSection {
  id: string;
  title: string;
  text: string;
}

interface LegalDocumentProps {
  title: string;
  lead: string;
  /** Etiqueta de versión y estado («Borrador para revisión legal…»). */
  badge: ReactNode;
  tocLabel: string;
  tocHeading: string;
  sections: LegalSection[];
  /** Cuadro destacado antes de las secciones (V-07). */
  note?: { title: string; text: string };
  /** Plazos de conservación (V-08). */
  retention?: { label: string; items: { where: string; term: string }[] };
  children?: ReactNode;
}

/** Estructura común de los textos legales (V-07 y V-08): índice a la izquierda, texto a la derecha. */
export function LegalDocument({
  title,
  lead,
  badge,
  tocLabel,
  tocHeading,
  sections,
  note,
  retention,
}: LegalDocumentProps) {
  return (
    <PublicShell>
      <div className="flex flex-wrap items-start gap-5">
        <LegalToc
          label={tocLabel}
          heading={tocHeading}
          items={sections.map((s, i) => ({ id: s.id, n: i + 1, title: s.title }))}
        />
        <article className="border-line bg-panel flex min-w-0 flex-[999_1_620px] flex-col gap-[26px] rounded-[28px] border p-6 backdrop-blur-lg sm:px-11 sm:py-10">
          <header className="flex flex-col gap-3">
            <span className="border-line bg-panel-2 inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[13px] font-semibold">
              <Icon name="info" size={14} strokeWidth={2.4} className="text-warning" />
              {badge}
            </span>
            <h1 className="font-display text-[40px] leading-[1.02] font-medium tracking-[-0.035em] sm:text-5xl">
              {title}
            </h1>
            <p className="text-muted max-w-[66ch] text-[17px] leading-[1.6]">{lead}</p>
          </header>

          {note ? (
            <div
              role="note"
              className="border-line bg-panel-2 border-l-accent flex items-start gap-3 rounded-[18px] border border-l-4 px-4 py-3.5"
            >
              <Icon name="lock" className="text-accent" />
              <div className="flex min-w-0 flex-col gap-1">
                <b className="text-sm">{note.title}</b>
                <span className="text-muted text-sm leading-[1.5]">{note.text}</span>
              </div>
            </div>
          ) : null}

          {retention ? (
            <ul
              aria-label={retention.label}
              className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 p-0"
            >
              {retention.items.map((item) => (
                <li
                  key={item.where}
                  className="border-line bg-panel-2 flex flex-col gap-1 rounded-[20px] border px-[18px] py-4"
                >
                  <span className="text-muted text-[13px]">{item.where}</span>
                  <b className="font-display text-[22px] font-medium tracking-[-0.02em]">
                    {item.term}
                  </b>
                </li>
              ))}
            </ul>
          ) : null}

          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="flex max-w-[72ch] scroll-mt-6 flex-col gap-2.5"
            >
              <h2 className="text-[21px] font-semibold">
                {index + 1}. {section.title}
              </h2>
              <p className="text-muted text-base leading-[1.7]">{section.text}</p>
            </section>
          ))}
        </article>
      </div>
    </PublicShell>
  );
}
