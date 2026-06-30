import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Визуал — агентство недвижимости",
    template: "%s | Визуал",
  },
  description:
    "Агентство недвижимости «Визуал»: продажа квартир и домов. Большой каталог проверенных объектов и личный агент на каждом этапе сделки.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Визуал",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${cormorant.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-bg text-text">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
