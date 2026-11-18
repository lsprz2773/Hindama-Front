"use client";

import { useCallback, useEffect, useState } from "react";

/** Formatea segundos como m:ss (p. ej. 42 → «0:42»). */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** Cuenta regresiva en segundos; `restart` la reinicia (p. ej. al reenviar un código). */
export function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const restart = useCallback(
    (seconds: number = initialSeconds) => setRemaining(seconds),
    [initialSeconds],
  );

  return { remaining, done: remaining <= 0, restart };
}
