import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Con `globals: false` Testing Library no limpia solo el DOM entre pruebas.
afterEach(() => cleanup());
