import { useId, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";

interface HelpPanelProps {
  title: string;
  /** Con icono, el panel destaca (p. ej. «Tus credenciales están cifradas»). */
  icon?: IconName;
  children: ReactNode;
}

/**
 * C-10. Ayuda contextual de las pantallas de configuración (RNF-14): tarjeta lateral con un
 * título y texto o una lista breve. No oculta nada: la ayuda siempre está a la vista.
 */
export function HelpPanel({ title, icon, children }: HelpPanelProps) {
  const id = useId();
  return (
    <aside
      aria-labelledby={id}
      className="border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="bg-progress-bg text-accent inline-flex size-11 items-center justify-center rounded-[14px]"
        >
          <Icon name={icon} />
        </span>
      ) : null}
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="text-muted [&_b]:text-fg text-sm leading-[1.55] [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-[18px]">
        {children}
      </div>
    </aside>
  );
}
