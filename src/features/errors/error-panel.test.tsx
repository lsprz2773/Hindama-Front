import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import es from "@/messages/es.json";
import { ErrorPanel, type ErrorCode } from "./error-panel";

vi.mock("@/components/layout/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function renderPanel(code: ErrorCode, props: Partial<Parameters<typeof ErrorPanel>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <ErrorPanel code={code} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("páginas de error (V-12)", () => {
  it.each([
    [401, "Tu sesión terminó", "/sign-in"],
    [403, "Esta sección no es para tu rol", "/admin"],
    [404, "No encontramos esta página", "/projects"],
  ] as const)("%i muestra su título y una salida", (code, title, href) => {
    renderPanel(code);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", href);
  });

  it("500 reintenta y muestra solo la referencia, no detalles internos", async () => {
    const onRetry = vi.fn();
    renderPanel(500, { reference: "7f3a-91c2", onRetry });
    expect(screen.getByText("Referencia: 7f3a-91c2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("503 ofrece reintentar", () => {
    renderPanel(503);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });

  it("429 bloquea el reintento hasta que termina la espera", () => {
    renderPanel(429, { retryAfter: 30 });
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("0:30");
  });
});
