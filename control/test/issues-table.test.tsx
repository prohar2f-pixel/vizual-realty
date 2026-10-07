import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { IssuesTable } from "../src/app/IssuesTable";

test("offers filters for advertising, data quality, support, and employee search", () => {
  const html = renderToStaticMarkup(<IssuesTable issues={[
    { id: "1", canonicalId: "1", ruleCode: "missing-floor", status: "open", lastSeenAt: "2026-09-30T10:00:00.000Z", agentName: "Юлия Банитюк", realtyType: "flat" },
    { id: "2", canonicalId: "2", ruleCode: "missing-agent", status: "open", lastSeenAt: "2026-09-30T10:00:00.000Z", agentName: null, realtyType: "land" },
  ]} />);

  expect(html).toContain("Поиск по ID или сотруднику");
  expect(html).toContain("Ответственный");
  expect(html).toContain("Юлия Банитюк");
  expect(html).toContain("Не назначен / не передан");
  expect(html).toContain("Тип объекта");
  expect(html).toContain("Квартиры и комнаты");
  expect(html).toContain("Дома");
  expect(html).toContain("Земельные участки");
  expect(html).toContain("Не добавлены в рекламу");
  expect(html).toContain("Не заполнены обязательные поля");
  expect(html).toContain("Для поддержки Topnlab");
});
