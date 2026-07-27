import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import ContactsPage from "../src/app/(public)/contacts/page";
import { ContactsPageView } from "../src/components/site-content/ContactsPageView";
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
  expect(html).toContain("https://t.me/olyadanskaya");
  expect(html).toContain("/managers/olga-krivutsa.webp");
  expect(html).toContain("Тсаренко Виктория");
  expect(html).toContain("+7 (963) 532-80-09");
  expect(html).toContain("https://t.me/Vikel_22");
  expect(html).toContain("/managers/tsarenko-viktoria.webp");
  expect(html).not.toContain("Фамилия Имя");
});

test("contacts page preserves approved Telegram links", async () => {
  const html = renderToStaticMarkup(await ContactsPage());

  expect(html).toContain("https://t.me/Lena_Katana");
  expect(html).toContain("https://t.me/juliaborokha24");
});

test("keeps thirty visible employees inside a bounded non-overlapping list", () => {
  const template = DEFAULT_SITE_CONTENT.team.members[0];
  const members = Array.from({ length: 30 }, (_, index) => ({
    ...template,
    id: `employee-${index + 1}`,
    name: `Сотрудник ${index + 1}`,
    topnlabAgentId: `${400000 + index}`,
  }));

  const html = renderToStaticMarkup(
    <ContactsPageView
      content={DEFAULT_SITE_CONTENT.contacts}
      members={members}
    />,
  );

  expect(
    html.match(/aria-label="Написать менеджеру: Сотрудник \d+"/g),
  ).toHaveLength(30);
  expect(html).toMatch(
    /aria-label="Список сотрудников"[^>]*class="[^"]*overflow-y-auto/,
  );
});
