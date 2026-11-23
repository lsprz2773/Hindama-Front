import { useTranslations } from "next-intl";
import { ErrorPanel } from "@/features/errors/error-panel";

export default function NotFound() {
  const t = useTranslations("Errors");
  return (
    <>
      {/* React 19 lleva el `<title>` al `<head>`: la pestaña dice «No encontramos esta página · Hindama». */}
      <title>{`${t("404.title")} · Hindama`}</title>
      <ErrorPanel code={404} />
    </>
  );
}
