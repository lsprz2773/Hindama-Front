import type { Metadata } from "next";
import { JetBrains_Mono, Lexend, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HydrationFlag } from "@/components/ui/hydration-flag";
import { ToastProvider } from "@/components/ui/toast";
import { routing } from "@/i18n/routing";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <html
      lang={locale}
      className={`${jakarta.variable} ${lexend.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="bg-accent text-on-accent sr-only z-[200] rounded-xl px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            {t("skipToContent")}
          </a>
          <ToastProvider>{children}</ToastProvider>
          <HydrationFlag />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
