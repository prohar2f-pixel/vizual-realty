import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import {
  TeamCarousel,
  type TeamManager,
} from "../src/components/TeamCarousel";

function manager(id: string, name = `Менеджер ${id}`) {
  return {
    id,
    name,
    phone: "+7 (949) 000-00-00",
    phoneHref: "tel:+79490000000",
    contactUrl: "mailto:test@example.com",
    contactLabel: "Написать на e-mail",
    contactExternal: false,
    photoUrl: `/managers/${id}.webp`,
  } as TeamManager;
}

function desktopIds(html: string) {
  const start = html.indexOf('<div class="hidden items-center gap-5 lg:flex"');
  const end = html.indexOf(
    '<p class="mt-4 text-center text-sm font-medium text-text/60 lg:hidden"',
    start,
  );
  const desktop = start >= 0 && end >= 0 ? html.slice(start, end) : "";
  return Array.from(
    desktop.matchAll(/<article[^>]*data-manager-id="([^"]+)"/g),
    (match) => match[1],
  );
}

test("renders a safe empty state for zero managers", () => {
  const html = renderToStaticMarkup(<TeamCarousel managers={[]} />);

  expect(html).toContain("Нет сотрудников для показа");
  expect(html).not.toContain("NaN");
  expect(html).not.toContain("Предыдущие менеджеры");
});

test.each([
  [1, ["manager-1"]],
  [2, ["manager-1", "manager-2"]],
  [3, ["manager-1", "manager-2", "manager-3"]],
] as const)(
  "renders %i distinct desktop cards without modulo duplicates",
  (count, expectedIds) => {
    const managers = Array.from({ length: count }, (_, index) =>
      manager(`manager-${index + 1}`),
    );
    const html = renderToStaticMarkup(<TeamCarousel managers={managers} />);

    expect(desktopIds(html)).toEqual(expectedIds);
    expect(new Set(desktopIds(html)).size).toBe(count);
  },
);

test("disables navigation for one manager and keeps the indicator finite", () => {
  const html = renderToStaticMarkup(
    <TeamCarousel managers={[manager("only")]} />,
  );

  expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Предыдущие менеджеры"/);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Следующие менеджеры"/);
  expect(html).toContain("1 из 1");
});

test("uses stable ids so duplicate manager names do not create duplicate keys", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

  renderToStaticMarkup(
    <TeamCarousel
      managers={[
        manager("first", "Одинаковое имя"),
        manager("second", "Одинаковое имя"),
      ]}
    />,
  );

  expect(error.mock.calls.flat().join(" ")).not.toContain(
    "Encountered two children with the same key",
  );
  error.mockRestore();
});
