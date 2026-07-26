import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import AboutPage from "../src/app/(public)/about/page";
import ContactsPage from "../src/app/(public)/contacts/page";
import Home from "../src/app/(public)/page";
import TeamPage from "../src/app/(public)/team/page";
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

test("keeps the pre-preview Home hero and company copy", async () => {
  const html = renderToStaticMarkup(await Home());

  expect(html).toContain("Недвижимость в Донецке");
  expect(html).toContain(
    "Продажа квартир, домов, и земельных участков.<br/>Большой каталог проверенных объектов и личный агент сопровождающий всю сделку.",
  );
  expect(html).toContain("Почему «Визуал»");
  expect(html).toContain("Сопровождение сделки под ключ");
});

test("keeps the pre-preview Team heading and introduction", async () => {
  const html = renderToStaticMarkup(await TeamPage());

  expect(html).toContain(">Наша команда</h1>");
  expect(html).toContain(
    "Выберите менеджера, который поможет с подбором объекта и сопровождением сделки.",
  );
});

test("keeps the pre-preview About call-to-action sentence capitalization", async () => {
  const html = renderToStaticMarkup(await AboutPage());

  expect(html).toMatch(
    /В разделе <a [^>]*>КОМАНДА<\/a> Вы можете выбрать для работы любого менеджера нашей компании и позвонить ему напрямую 🤝/,
  );
});

test("keeps the pre-preview Contacts labels and Yandex destination", async () => {
  const html = renderToStaticMarkup(await ContactsPage());

  expect(html).toContain("Контакты менеджеров");
  expect(html).toContain("г. Донецк, ул. 50 лет СССР, 142");
  const encodedMapAddress = html.match(
    /<iframe src="https:\/\/yandex\.ru\/map-widget\/v1\/\?mode=search&amp;text=([^&"]+)&amp;z=16"/,
  )?.[1];
  expect(decodeURIComponent(encodedMapAddress ?? "")).toBe(
    "Донецк, улица 50-летия СССР, 142",
  );
  expect(html).toContain('href="https://yandex.ru/maps/?mode=search&amp;text=');
});
