import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/format", () => ({ formatPrice: () => "5 000 000 ₽" }));

test("does not show a house number in a public property card title", async () => {
  const { PropertyCard } = await import("../src/components/PropertyCard");
  const html = renderToStaticMarkup(
    <PropertyCard
      id="test-id"
      title="Квартира, ул. Артёма, д. 15"
      price={5_000_000}
      rooms={2}
      area={54}
      floor={2}
      floors={9}
      district="Киевский р-н"
      photo={null}
    />,
  );

  expect(html).toContain("Квартира, ул. Артёма");
  expect(html).not.toContain("д. 15");
  expect(html).toContain("2/9 этаж");
});
