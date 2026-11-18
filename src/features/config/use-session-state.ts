"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Estado simulado que persiste en sessionStorage mientras no exista la API.
 * TODO(api): cada uso se reemplaza por consultas y mutaciones reales.
 */
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, initial: T): T {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(key);
  } catch {
    // Sin almacenamiento: se usa el valor guardado en memoria.
    raw = (cache.get(key)?.raw as string | null) ?? null;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = initial;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function useSessionState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(key, initial),
    () => initial,
  );

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = read(key, initial);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(current) : next;
      const raw = JSON.stringify(resolved);
      try {
        sessionStorage.setItem(key, raw);
      } catch {
        // Solo memoria.
      }
      cache.set(key, { raw, value: resolved });
      listeners.forEach((l) => l());
    },
    [key, initial],
  );

  return [value, set];
}
