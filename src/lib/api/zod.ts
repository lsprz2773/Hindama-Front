import { z } from "zod";

/**
 * Piezas de Zod comunes al navegador y al BFF (guía del frontend §4, convenciones §5 y §8.2).
 * Los mensajes de error son los `errors[].code` del contrato (`validation.required`,
 * `validation.length`, `validation.format`), así el formulario muestra el mismo texto que
 * mostraría con la respuesta de la API.
 */

export const FIELD_CODES = {
  required: "validation.required",
  length: "validation.length",
  format: "validation.format",
} as const;

/** Caracteres de control prohibidos en textos de una línea (U+0000–U+001F y U+007F). */
const CONTROL = /[\u0000-\u001F\u007F]/;
/** En textos de varias líneas se admiten tabulador, salto de línea y retorno de carro. */
const CONTROL_MULTILINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Normaliza a NFC y recorta espacios, como la API (convenciones §8.2). */
export function normalizeText(value: string): string {
  return value.normalize("NFC").trim();
}

export function hasControlChars(value: string, multiline = false): boolean {
  return (multiline ? CONTROL_MULTILINE : CONTROL).test(value);
}

interface TextOptions {
  /** Longitud mínima tras recortar; `1` hace el campo obligatorio. */
  min?: number;
  max: number;
  multiline?: boolean;
  /** No recortar (contraseñas y credenciales: los espacios cuentan). */
  raw?: boolean;
}

/** Texto saneado: NFC, recortado, sin caracteres de control y con longitud acotada. */
export function zText({ min = 0, max, multiline = false, raw = false }: TextOptions) {
  return z
    .string({ error: FIELD_CODES.required })
    .transform((value) => (raw ? value.normalize("NFC") : normalizeText(value)))
    .superRefine((value, ctx) => {
      if (value.length === 0 && min > 0) {
        ctx.addIssue({ code: "custom", message: FIELD_CODES.required });
      } else if (value.length < min || value.length > max) {
        ctx.addIssue({ code: "custom", message: FIELD_CODES.length });
      } else if (hasControlChars(value, multiline)) {
        ctx.addIssue({ code: "custom", message: FIELD_CODES.format });
      }
    });
}

/** Identificador de la plataforma: UUID en texto, opaco (convenciones §5). */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const zUuid = z.string().regex(UUID_PATTERN, { message: FIELD_CODES.format });

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Correo con forma mínima; Cognito hace la verificación real (guía §2.2). */
export const zEmail = zText({ min: 1, max: 254 }).pipe(
  z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, { message: FIELD_CODES.format }),
);

/** Fecha y hora RFC 3339 (convenciones §5). */
export const zDateTime = z.iso.datetime({ offset: true });

/**
 * Errores de un esquema como `{ campo: [códigos] }`, la misma forma que `ApiError.fields`.
 * El campo usa la ruta con puntos del contrato (`credential.value`, `modules.0`).
 */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "_";
    // Códigos del contrato (`validation.*`, `url.*`…); cualquier otro mensaje cuenta como formato.
    const code = /^[a-z_]+\.[a-z_]+$/.test(issue.message) ? issue.message : FIELD_CODES.format;
    (fields[field] ??= []).push(code);
  }
  return fields;
}

/** Igualdad exacta de tipos: comprueba que un esquema de Zod produce el tipo del contrato. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Falla en `tsc` si `T` no es `true`; no hace nada al ejecutarse. */
export function assertType<T extends true>(value?: T): void {
  void value;
}
