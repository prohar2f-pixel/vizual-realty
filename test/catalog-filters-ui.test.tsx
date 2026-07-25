import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogFilters } from "../src/components/CatalogFilters";

test("renders approved filters in order and disables district without city", () => {
  const html = renderToStaticMarkup(
    <CatalogFilters cities={["Донецк", "Макеевка"]} districts={[]} current={{}} />,
  );
  const labels = ["Тип объекта", "Город", "Район", "Комнаты", "Цена от", "Цена до"];
  const positions = labels.map((label) => html.indexOf(label));

  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(
    positions.every(
      (position, index) => index === 0 || position > positions[index - 1],
    ),
  ).toBe(true);
  expect(html).toContain('name="objectType"');
  expect(html).toContain('value="flat"');
  expect(html).toContain('value="house"');
  expect(html).toContain('value="land"');
  expect(html).toMatch(/name="district"[^>]*\sdisabled=""/);
  expect(html).toContain('name="priceMin"');
  expect(html).toContain('name="priceMax"');
});

test("enables only the supplied districts for a selected city", () => {
  const html = renderToStaticMarkup(
    <CatalogFilters
      cities={["Донецк"]}
      districts={["Киевский р-н"]}
      current={{ city: "Донецк", district: "Киевский р-н" }}
    />,
  );

  expect(html).toContain("Киевский р-н");
  expect(html).not.toMatch(/name="district"[^>]*\sdisabled=""/);
});
