"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { auditLogPageSchema, type AuditAction } from "@/lib/api/schemas/admin";
import { useHttpClient } from "@/lib/http/browser";

export interface AuditLogFilters {
  page: number;
  pageSize: number;
  /** Inicio (incluido) y fin (excluido) en RFC 3339 con zona. */
  occurredFrom?: string;
  occurredTo?: string;
  action?: AuditAction;
  /** `id` interno completo (UUID). */
  userId?: string;
  /** Nombre o URL del host: la API compara su HMAC y nunca lo devuelve. */
  host?: string;
  enabled?: boolean;
}

export const AUDIT_LOG_KEY = ["admin", "audit-log"] as const;

/** `listAuditLog` (V-34): de la acción más reciente a la más antigua, paginada por la API. */
export function useAuditLog({
  page,
  pageSize,
  occurredFrom,
  occurredTo,
  action,
  userId,
  host,
  enabled = true,
}: AuditLogFilters) {
  const http = useHttpClient();
  return useQuery({
    queryKey: [
      ...AUDIT_LOG_KEY,
      { page, pageSize, occurredFrom, occurredTo, action, userId, host },
    ],
    queryFn: async ({ signal }) =>
      (
        await http.read("/admin/audit-log", auditLogPageSchema, {
          query: {
            page,
            page_size: pageSize,
            occurred_from: occurredFrom,
            occurred_to: occurredTo,
            action: action ? [action] : undefined,
            user_id: userId,
            host,
          },
          signal,
        })
      ).data,
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
