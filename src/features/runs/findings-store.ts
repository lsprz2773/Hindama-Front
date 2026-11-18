"use client";

import { useSessionState } from "@/features/config/use-session-state";
import { SEED_FINDINGS, type Finding } from "./data";

/** Hallazgos de un proyecto. TODO(api): solo `pedidos` trae ejemplos; los demás están vacíos. */
export function useFindings(projectId: string) {
  const [findings, setFindings] = useSessionState<Finding[]>(
    `hindama.findings.${projectId}`,
    projectId === "pedidos" ? SEED_FINDINGS : [],
  );
  return {
    findings,
    update(id: string, patch: Partial<Finding>) {
      setFindings((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    },
  };
}

export function isOpen(finding: Finding): boolean {
  return finding.status !== "acceptedRisk" && finding.status !== "resolved";
}
