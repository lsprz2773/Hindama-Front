import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { STATUS_TONE, StatusBadge } from "./status-badge";

describe("insignias de estado (C-05)", () => {
  it("muestra siempre el texto del estado, no solo el color", () => {
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <StatusBadge kind="project" status="pendingVerification" />
        <StatusBadge kind="run" status="running" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Pendiente de verificación")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
  });

  it("tiene traducción en español e inglés para cada estado", () => {
    for (const messages of [es, en]) {
      for (const [kind, statuses] of Object.entries(STATUS_TONE)) {
        for (const status of Object.keys(statuses)) {
          const group = (messages.Status as Record<string, Record<string, string>>)[kind];
          expect(group[status], `${kind}.${status}`).toBeTruthy();
        }
      }
    }
  });
});
