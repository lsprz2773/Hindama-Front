/**
 * Traducción entre los nombres internos de la interfaz y los valores del contrato
 * (`hindama-docs/03-api/openapi.yaml`, 0.6.0). Las vistas siguen usando sus nombres;
 * solo esta capa conoce los del contrato.
 */

export interface EnumAdapter<Ui extends string, Api extends string> {
  /** Valor de la interfaz → valor del contrato. Total: TypeScript exige cada valor. */
  toApi(value: Ui): Api;
  /** Valor del contrato → valor de la interfaz. Un valor desconocido devuelve el respaldo. */
  fromApi(value: string): Ui;
  /** `true` si el valor es uno de los que define el contrato. */
  isApi(value: string): value is Api;
  readonly apiValues: readonly Api[];
}

export type UnknownValueLogger = (dimension: string, value: string, fallback: string) => void;

let logUnknown: UnknownValueLogger = (dimension, value, fallback) => {
  console.warn(`[contract] ${dimension}: valor desconocido «${value}»; se usa «${fallback}».`);
};

/** Permite a las pruebas (o a un registro futuro) capturar los valores desconocidos. */
export function setUnknownValueLogger(logger: UnknownValueLogger) {
  const previous = logUnknown;
  logUnknown = logger;
  return previous;
}

/**
 * Crea un adaptador a partir de una tabla exhaustiva `Record<Ui, Api>`. La tabla debe ser
 * biyectiva: dos valores de la interfaz no pueden ir al mismo valor del contrato.
 */
export function createEnumAdapter<Ui extends string, Api extends string>(
  dimension: string,
  table: Record<Ui, Api>,
  fallback: NoInfer<Ui>,
): EnumAdapter<Ui, Api> {
  const reverse = new Map<string, Ui>();
  for (const [ui, api] of Object.entries(table) as [Ui, Api][]) {
    if (reverse.has(api)) throw new Error(`[contract] ${dimension}: «${api}» está repetido.`);
    reverse.set(api, ui);
  }
  const apiValues = [...reverse.keys()] as Api[];

  return {
    toApi: (value) => table[value],
    fromApi(value) {
      const ui = reverse.get(value);
      if (ui !== undefined) return ui;
      logUnknown(dimension, value, fallback);
      return fallback;
    },
    isApi: (value): value is Api => reverse.has(value),
    apiValues,
  };
}
