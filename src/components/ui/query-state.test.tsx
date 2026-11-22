import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http";
import es from "@/messages/es.json";
import { QueryState } from "./query-state";

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

function renderWith(error: ApiError | null, data?: string) {
  const query = {
    status: error
      ? ("error" as const)
      : data !== undefined
        ? ("success" as const)
        : ("pending" as const),
    data,
    error,
    refetch: vi.fn(),
  };
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <QueryState query={query} skeleton={<p>cargando</p>} subject="los proyectos">
        {(value) => <p>{value}</p>}
      </QueryState>
    </NextIntlClientProvider>,
  );
}

describe("estados de una consulta (C-13, V-12)", () => {
  it("muestra los datos cuando llegan", async () => {
    renderWith(null, "Tienda");
    expect(await screen.findByText("Tienda")).toBeInTheDocument();
  });

  it.each([
    [403, "role.forbidden", "Esta sección no es para tu rol"],
    [404, "resource.not_found", "No encontramos esta página"],
  ])("%i (%s) usa la página de error de V-12", (status, code, title) => {
    renderWith(new ApiError({ status, code, requestId: "r-1" }));
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByText(/r-1/)).not.toBeInTheDocument();
  });

  it("429 espera lo que indica Retry-After", () => {
    renderWith(new ApiError({ status: 429, code: "rate_limit.exceeded", retryAfter: 42 }));
    expect(screen.getByText(/0:42/)).toBeInTheDocument();
  });

  it.each([500, 503])("%i muestra el request_id para reportarlo", (status) => {
    renderWith(new ApiError({ status, code: "internal", requestId: "0192e3b1-0000-7000" }));
    expect(screen.getByText(/0192e3b1-0000-7000/)).toBeInTheDocument();
  });

  it("401 no muestra un error: el marco de la sesión lleva a iniciar sesión", () => {
    renderWith(new ApiError({ status: 401, code: "auth.invalid_token" }));
    expect(screen.getByText("cargando")).toBeInTheDocument();
  });
});
