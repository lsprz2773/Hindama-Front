import {
  CONTRACT_MAX_BYTES,
  contractFileError,
  contractUrlSchema,
} from "@/lib/api/schemas/contracts";
import { fieldErrors, FIELD_CODES } from "@/lib/api/zod";

/** Margen para las cabeceras del formulario por encima del documento de 5 MB. */
export const CONTRACT_FORM_MAX_BYTES = CONTRACT_MAX_BYTES + 64 * 1024;

/**
 * `ContractImport`: exactamente uno de `file` o `url`, sin otros campos. Del archivo se valida
 * solo el tamaño y el tipo; su contenido lo analiza la API (RF-22). Se reenvía un formulario
 * nuevo con lo validado, no el que mandó el navegador.
 */
export function validateContractImport(form: FormData): FormData | Record<string, string[]> {
  const keys = [...new Set(form.keys())];
  if (keys.some((key) => key !== "file" && key !== "url")) return { _: [FIELD_CODES.format] };
  if (form.getAll("file").length + form.getAll("url").length !== 1) {
    return { _: ["contract.source_required"] };
  }
  const out = new FormData();
  const file = form.get("file");
  if (file !== null) {
    if (!(file instanceof File)) return { file: [FIELD_CODES.format] };
    const error = contractFileError(file);
    if (error) return { file: [error] };
    out.set("file", file, file.name);
    return out;
  }
  const url = contractUrlSchema.safeParse(form.get("url"));
  if (!url.success) return { url: fieldErrors(url.error)._ ?? [FIELD_CODES.format] };
  out.set("url", url.data);
  return out;
}
