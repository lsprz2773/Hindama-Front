import { ErrorPanel } from "@/features/errors/error-panel";

export default function NotFound() {
  return <ErrorPanel code={404} />;
}
