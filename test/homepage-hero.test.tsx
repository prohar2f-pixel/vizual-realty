import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import Home from "../src/app/page";

vi.mock("@/lib/db", () => ({
  db: { property: { findMany: vi.fn().mockResolvedValue([]) } },
}));

vi.mock("@/components/PropertyCard", () => ({
  PropertyCard: () => null,
}));

test("renders the approved homepage hero copy as two explicit lines", async () => {
  const html = renderToStaticMarkup(await Home());

  expect(html).toContain(
    "Продажа квартир, домов, и земельных участков.<br/>Большой каталог проверенных объектов и личный агент сопровождающий всю сделку.",
  );
  expect(html).toContain(
    'class="mx-auto text-base font-bold text-on-brand sm:whitespace-nowrap sm:text-sm xl:text-base 2xl:text-lg"',
  );
});
