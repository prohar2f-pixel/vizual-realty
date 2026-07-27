import type { Metadata } from "next";
import { getSiteUrl } from "../lib/site-url";

export const siteMetadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
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
