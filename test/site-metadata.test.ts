import { expect, test } from "vitest";
import { siteMetadata } from "../src/app/site-metadata";

test("targets the Donetsk real-estate search query in the homepage metadata", () => {
  expect(siteMetadata.title).toMatchObject({
    default: "Недвижимость в Донецке — квартиры, дома и участки | Визуал",
  });
  expect(siteMetadata.description).toBe(
    "Недвижимость в Донецке: продажа квартир, домов и земельных участков. Каталог проверенных объектов, помощь опытного агента и сопровождение сделки.",
  );
});
