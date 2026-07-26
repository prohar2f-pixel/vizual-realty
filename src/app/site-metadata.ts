import type { Metadata } from "next";

export const siteMetadata: Metadata = {
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
