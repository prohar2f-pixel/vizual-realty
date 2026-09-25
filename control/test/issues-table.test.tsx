import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { IssuesTable } from "../src/app/IssuesTable";

test("offers filters for advertising, data quality, support, and employee search", () => {
  const html = renderToStaticMarkup(<IssuesTable issues={[]} />);

  expect(html).toContain("Поиск по ID или сотруднику");
  expect(html).toContain("Не добавлены в рекламу");
  expect(html).toContain("Не заполнены обязательные поля");
  expect(html).toContain("Для поддержки Topnlab");
});
