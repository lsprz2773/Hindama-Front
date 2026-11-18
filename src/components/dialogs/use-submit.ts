"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@/lib/http";

export interface SubmitError {
  title: string;
  text?: string;
}

/**
 * Estados internos de un modal (C-20): normal → enviando → error | cerrado.
 * `map` traduce un error de la API al texto que se muestra dentro del modal.
 */
export function useSubmit(
  action: () => Promise<void>,
  onDone: () => void,
  map?: (error: ApiError | unknown) => SubmitError,
  fallback: SubmitError = { title: "Error" },
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SubmitError>();

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await action();
      onDone();
    } catch (e) {
      setError(map ? map(e) : fallback);
    } finally {
      setBusy(false);
    }
  }, [action, busy, fallback, map, onDone]);

  const reset = useCallback(() => {
    setBusy(false);
    setError(undefined);
  }, []);

  return { busy, error, submit, reset };
}
