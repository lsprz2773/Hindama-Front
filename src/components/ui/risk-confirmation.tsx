"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "radix-ui";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface RiskModule {
  id: string;
  name: string;
  /** Nivel de riesgo en palabras («modifica datos», «carga el servidor»). */
  level: string;
}

interface RiskConfirmationProps {
  modules: RiskModule[];
  /** Ids ya confirmados. La confirmación se pide en cada ejecución (RF-46, RN-05). */
  confirmed: string[];
  onToggle: (id: string, confirmed: boolean) => void;
  /** Resumen de qué hacen los módulos elegidos. */
  summary: string;
}

/**
 * C-08. Advertencia de módulos de riesgo: cada módulo que modifica datos o carga el servidor
 * exige su propia confirmación explícita antes de poder ejecutar.
 */
export function RiskConfirmation({ modules, confirmed, onToggle, summary }: RiskConfirmationProps) {
  const t = useTranslations("RiskConfirmation");
  if (modules.length === 0) return null;
  const pending = modules.filter((m) => !confirmed.includes(m.id)).length;

  return (
    <section
      aria-labelledby="risk-h"
      className="border-line bg-panel border-l-warning flex flex-col gap-4 rounded-[28px] border border-l-4 p-6 backdrop-blur-lg"
    >
      <div className="flex items-center gap-3">
        <Icon name="alert" className="text-warning" />
        <h2 id="risk-h" className="text-lg font-semibold">
          {t("title")}
        </h2>
      </div>
      <p className="text-muted text-sm leading-[1.55]">
        {summary} {t("explanation")}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {modules.map((module) => {
          const checked = confirmed.includes(module.id);
          const id = `risk-${module.id}`;
          return (
            <li
              key={module.id}
              className={cn(
                "border-line bg-panel-2 rounded-[18px] border",
                checked && "border-accent",
              )}
            >
              <label htmlFor={id} className="flex cursor-pointer items-start gap-3.5 px-4 py-3.5">
                <Checkbox.Root
                  id={id}
                  checked={checked}
                  onCheckedChange={(value) => onToggle(module.id, value === true)}
                  aria-label={t("confirmModule", { name: module.name })}
                  className="border-line-strong bg-field data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-on-accent mt-0.5 inline-flex size-[22px] flex-none cursor-pointer items-center justify-center rounded-md border-2"
                >
                  <Checkbox.Indicator>
                    <Icon name="check" size={16} strokeWidth={3} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="text-[14.5px] leading-[1.45]">
                  <b>{module.name}</b> · {module.level}. {t("understand")}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {pending > 0 ? (
        <p role="status" className="text-muted text-[13.5px]">
          {t("pending", { count: pending })}
        </p>
      ) : null}
    </section>
  );
}
