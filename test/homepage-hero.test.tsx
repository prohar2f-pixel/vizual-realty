import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import Home from "../src/app/(public)/page";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";

const getPublishedContent = vi.hoisted(() => vi.fn());
const getFeaturedProperties = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/site-content/published", () => ({ getPublishedContent }));
vi.mock("../src/lib/featured", () => ({ getFeaturedProperties }));

vi.mock("../src/components/PropertyCard", () => ({
  PropertyCard: () => null,
}));

beforeEach(() => {
  getPublishedContent.mockResolvedValue(structuredClone(DEFAULT_SITE_CONTENT));
  getFeaturedProperties.mockResolvedValue([]);
});

test("renders the approved homepage hero copy as two explicit lines", async () => {
  const html = renderToStaticMarkup(await Home());

  expect(html).toContain(
    "Продажа квартир, домов, и земельных участков.<br/>Большой каталог проверенных объектов и личный агент сопровождающий всю сделку.",
  );
  expect(html).toContain(
    'class="mx-auto text-base font-bold text-on-brand sm:whitespace-nowrap sm:text-sm xl:text-base 2xl:text-lg"',
  );
});

test("renders the approved Why Vizual introduction and benefits", async () => {
  const html = renderToStaticMarkup(await Home());

  expect(html).toContain(
    "Мы поможем купить или продать недвижимость с заботой и вниманием к деталям. Каждый объект проверен юристами, а сопроводит вашу сделку опытный агент.",
  );
  expect(html).toContain("Большой каталог");
  expect(html).toContain("более 200 проверенных объектов");
  expect(html).toContain("Опытный агент");
  expect(html).toContain("на каждом этапе сделки, полное сопровождение");
  expect(html).toContain("Открытие ипотеки бесплатно");
  expect(html).toContain("Сопровождение сделки под ключ");
  expect(html).toContain("от звонка до получения ключей");
  expect(html).not.toContain("Более 200 проверенных квартир и домов");
});
