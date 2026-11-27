import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authTypeAdapter,
  createEnumAdapter,
  dismissalReasonAdapter,
  findingStatusAdapter,
  identityRoleAdapter,
  identityStatusFromApi,
  MODULE_RISK,
  moduleAdapter,
  policyAdapter,
  requiresOwnerField,
  requiresRiskConfirmation,
  resolutionReasonAdapter,
  roleAdapter,
  runStatusAdapter,
  setUnknownValueLogger,
  severityAdapter,
  type EnumAdapter,
  type UnknownValueLogger,
} from ".";

let restore: UnknownValueLogger | undefined;
afterEach(() => {
  if (restore) setUnknownValueLogger(restore);
  restore = undefined;
});

function roundTrips<Ui extends string, Api extends string>(
  adapter: EnumAdapter<Ui, Api>,
  table: Record<Ui, Api>,
) {
  for (const [ui, api] of Object.entries(table) as [Ui, Api][]) {
    expect(adapter.toApi(ui)).toBe(api);
    expect(adapter.fromApi(api)).toBe(ui);
  }
}

describe("capa de adaptación al contrato 0.6.0", () => {
  it("traduce los módulos en los dos sentidos", () => {
    roundTrips(moduleAdapter, {
      auth: "authentication",
      config: "configuration",
      objects: "object_access",
      functions: "function_access",
      properties: "property_access",
      resources: "resource_consumption",
      sql: "sql_injection",
    });
  });

  it("riesgo por módulo según el dashboard del contrato y RN-05", () => {
    const risky = Object.entries(MODULE_RISK)
      .filter(([, risk]) => requiresRiskConfirmation(risk))
      .map(([module]) => module);
    expect(risky).toEqual(["property_access", "resource_consumption", "sql_injection"]);
  });

  it("traduce las plantillas de política y exige owner_field en owner_only y owner_or_admin", () => {
    roundTrips(policyAdapter, {
      public: "public",
      authenticated: "authenticated",
      owner: "owner_only",
      ownerOrAdmin: "owner_or_admin",
      admin: "admin_only",
    });
    expect(policyAdapter.apiValues.filter(requiresOwnerField)).toEqual([
      "owner_only",
      "owner_or_admin",
    ]);
  });

  it("traduce los estados de hallazgo, la severidad y el estado de ejecución", () => {
    expect(findingStatusAdapter.toApi("acceptedRisk")).toBe("accepted_risk");
    expect(findingStatusAdapter.fromApi("accepted_risk")).toBe("acceptedRisk");
    for (const s of ["new", "persistent", "regression", "resolved"] as const) {
      expect(findingStatusAdapter.toApi(s)).toBe(s);
    }
    for (const s of ["critical", "high", "medium", "low", "info"] as const) {
      expect(severityAdapter.fromApi(s)).toBe(s);
    }
    expect(runStatusAdapter.apiValues).toEqual([
      "queued",
      "running",
      "completed",
      "cancelled",
      "failed",
    ]);
    expect(runStatusAdapter.isApi("cancelling")).toBe(false);
  });

  it("traduce motivos, identidades y rol", () => {
    roundTrips(dismissalReasonAdapter, {
      accepted: "accepted_risk",
      false_positive: "false_positive",
    });
    expect(resolutionReasonAdapter.apiValues).toEqual([
      "not_detected",
      "identity_deleted",
      "operation_retired",
    ]);
    expect(authTypeAdapter.apiValues).toEqual(["none", "login", "bearer", "cookie", "header"]);
    expect(identityRoleAdapter.apiValues).toEqual(["admin", "user", "other"]);
    expect(roleAdapter.fromApi("admin")).toBe("admin");
    expect(identityStatusFromApi("expired_credential", null)).toBe("expiredCredential");
    expect(identityStatusFromApi("active", null)).toBe("untested");
    expect(identityStatusFromApi("active", "2026-11-04T15:32:09Z")).toBe("active");
  });

  it("un valor desconocido no falla: devuelve el respaldo y lo registra", () => {
    const log = vi.fn<UnknownValueLogger>();
    restore = setUnknownValueLogger(log);

    expect(moduleAdapter.fromApi("graphql_depth")).toBe("config");
    expect(findingStatusAdapter.fromApi("cancelling")).toBe("persistent");

    expect(log).toHaveBeenCalledWith("module", "graphql_depth", "config");
    expect(log).toHaveBeenCalledWith("finding_status", "cancelling", "persistent");
  });

  it("rechaza una tabla con dos valores de la interfaz hacia el mismo valor del contrato", () => {
    expect(() => createEnumAdapter("x", { a: "same", b: "same" }, "a")).toThrow(/repetido/);
  });
});
