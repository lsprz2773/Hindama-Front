"use client";

import { ErrorPanel } from "@/features/errors/error-panel";

/** 500: error inesperado. Solo se muestra el resumen de referencia, nunca el mensaje interno. */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorPanel code={500} reference={error.digest} onRetry={retry} />;
}
