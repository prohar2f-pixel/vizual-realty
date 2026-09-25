import { expect, test } from "vitest";

import { describeIssue, filterIssues, formatMoscowDate, summarizeIssues, summarizeSnapshots } from "../src/lib/dashboard";

test("describes an API-only object in clear Russian", () => {
  expect(describeIssue("api-not-in-xml")).toEqual({
    title: "Объект находится в рекламе по данным API, но отсутствует в XML-фиде",
    severity: "error",
    details: "API Topnlab с параметром in_ad вернул объект, но рекламный пакет «Корпоративный сайт» не передал его в XML-фид. Передайте ID в поддержку Topnlab.",
  });
});

test("describes an XML-only object as the known Topnlab in-ad discrepancy", () => {
  expect(describeIssue("xml-not-in-api")).toEqual({
    title: "Объект есть в XML-фиде, но отсутствует среди объектов в рекламе по API",
    severity: "warning",
    details: "Фид рекламного пакета «Корпоративный сайт» содержит объект, которого нет в ответе API с параметром in_ad. Это расхождение нужно проверять с поддержкой Topnlab.",
  });
});

test("describes an active object without advertising as an agency action", () => {
  expect(describeIssue("active-not-in-ad")).toEqual({
    title: "Действующий объект не добавлен в рекламу",
    severity: "error",
    details: "Карточка находится на рабочем этапе, но рекламный пакет «Корпоративный сайт» не активирован. Проверьте раздел «Сервисы» объекта в Topnlab.",
  });
});

test("describes a missing required field in clear Russian", () => {
  expect(describeIssue("missing-floor")).toEqual({
    title: "Не указан этаж",
    severity: "error",
    details: "Заполните этаж объекта в Topnlab.",
  });
});

test("marks a missing recommended description as a warning", () => {
  expect(describeIssue("missing-description")).toEqual({
    title: "Не заполнено описание",
    severity: "warning",
    details: "Добавьте описание объекта в Topnlab — это не блокирует выгрузку, но снижает качество карточки.",
  });
});

test("summarizes source counts without treating different totals as an error", () => {
  expect(summarizeSnapshots([
    { source: "api_all", status: "success", recordCount: 433 },
    { source: "xml", status: "success", recordCount: 348 },
    { source: "api", status: "success", recordCount: 356 },
    { source: "site", status: "success", recordCount: 348 },
  ])).toEqual({ apiAll: 433, xml: 348, api: 356, site: 348, notInAd: 77, apiOnly: 8, xmlOnly: 0, siteOnly: 0 });
});

test("filters issue rows by object ID and selected source mismatch", () => {
  expect(filterIssues([
    { canonicalId: "140742249", ruleCode: "api-not-in-xml" },
    { canonicalId: "139063232", ruleCode: "xml-not-in-api" },
  ], { query: "0742", ruleCode: "api-not-in-xml" })).toEqual([
    { canonicalId: "140742249", ruleCode: "api-not-in-xml" },
  ]);
});

test("filters issue rows by responsible employee and issue group", () => {
  expect(filterIssues([
    { canonicalId: "1", ruleCode: "missing-floor", agentName: "Аянот Елена" },
    { canonicalId: "2", ruleCode: "active-not-in-ad", agentName: "Иван Иванов" },
  ], { query: "аянот", ruleCode: "", group: "quality" })).toEqual([
    { canonicalId: "1", ruleCode: "missing-floor", agentName: "Аянот Елена" },
  ]);
});

test("filters every in-ad API-to-XML mismatch for Topnlab support", () => {
  expect(filterIssues([
    { canonicalId: "138189643", ruleCode: "api-not-in-xml", evidence: {} },
    { canonicalId: "140742249", ruleCode: "api-not-in-xml", evidence: {} },
    { canonicalId: "143317061", ruleCode: "xml-not-in-api", evidence: {} },
  ], { query: "", ruleCode: "", supportOnly: true })).toEqual([
    { canonicalId: "138189643", ruleCode: "api-not-in-xml", evidence: {} },
    { canonicalId: "140742249", ruleCode: "api-not-in-xml", evidence: {} },
    { canonicalId: "143317061", ruleCode: "xml-not-in-api", evidence: {} },
  ]);
});

test("counts actual directional differences instead of subtracting source totals", () => {
  expect(summarizeIssues([
    { canonicalId: "1", ruleCode: "api-not-in-xml" },
    { canonicalId: "2", ruleCode: "api-not-in-xml" },
    { canonicalId: "3", ruleCode: "xml-not-in-api" },
    { canonicalId: "4", ruleCode: "active-not-in-ad" },
    { canonicalId: "4", ruleCode: "missing-floor" },
    { canonicalId: "4", ruleCode: "missing-rooms" },
  ])).toEqual({ apiOnly: 2, xmlOnly: 1, siteOnly: 0, xmlOnlySite: 0, activeNotInAd: 1, quality: 1 });
});

test("formats audit timestamps in Moscow time on both server and browser", () => {
  expect(formatMoscowDate(new Date("2026-09-21T21:07:01.000Z"))).toBe("22.09.2026, 00:07:01");
});
