"use client";

import { useTranslations } from "next-intl";
import type { Evidence } from "@/lib/api/schemas/findings";
import { contextNotes, type ContextNote } from "./evidence";

/**
 * Datos propios del módulo que ayudan a leer la evidencia (`Evidence.context`, contrato 0.10.0).
 * Todo se pinta como texto: viene del servidor evaluado.
 */
export function ContextNotes({ context }: { context: Evidence["context"] }) {
  const t = useTranslations("EvidenceContext");
  const notes = contextNotes(context);
  if (notes.length === 0) return null;

  const text = (note: ContextNote) => {
    switch (note.id) {
      case "undeclared":
        return t("undeclared", { names: note.names });
      case "acceptedFields":
        return t("acceptedFields", { names: note.names });
      case "createdResource":
        return t(`createdResource.${note.status}`);
      case "requests":
        return t("requests", { count: note.count });
      case "bodyBytes":
        return t("bodyBytes", { count: note.count });
      case "operation":
        return t("operation", { value: note.value });
      case "parameter":
        return t("parameter", { value: note.value });
      case "payload":
        return t("payload", { value: note.value });
    }
  };

  return (
    <ul className="text-muted m-0 flex list-none flex-col gap-1 p-0 text-sm">
      {notes.map((note) => (
        <li key={note.id} className="break-words">
          {text(note)}
        </li>
      ))}
    </ul>
  );
}
