import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import ContactsPage from "../src/app/(public)/contacts/page";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";

const getPublishedContent = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/site-content/published", () => ({ getPublishedContent }));

beforeEach(() => {
  getPublishedContent.mockResolvedValue(structuredClone(DEFAULT_SITE_CONTENT));
});

test("contacts page shows Olga and Viktoria instead of a placeholder", async () => {
  const html = renderToStaticMarkup(await ContactsPage());

  expect(html).toContain("Ольга Кривуца");
  expect(html).toContain("+7 (978) 059-26-69");
  expect(html).toContain("mailto:olya_malina22@mail.ru");
  expect(html).toContain("/managers/olga-krivutsa.webp");
  expect(html).toContain("Тсаренко Виктория");
  expect(html).toContain("+7 (963) 532-80-09");
  expect(html).toContain("mailto:tsarenko.viktoria2000@mail.ru");
  expect(html).toContain("/managers/tsarenko-viktoria.webp");
  expect(html).not.toContain("Фамилия Имя");
});

test("contacts page preserves approved Telegram links", async () => {
  const html = renderToStaticMarkup(await ContactsPage());

  expect(html).toContain("https://t.me/Lena_Katana");
  expect(html).toContain("https://t.me/juliaborokha24");
});
