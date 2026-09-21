import { expect, test } from "vitest";

import { describeIssue, filterIssues, formatMoscowDate, summarizeIssues, summarizeSnapshots } from "../src/lib/dashboard";

test("describes an API-only object in clear Russian", () => {
  expect(describeIssue("api-not-in-xml")).toEqual({
    title: "Есть в API Topnlab, но нет в XML-фиде",
    severity: "warning",
  });
});

test("summarizes source counts without treating different totals as an error", () => {
  expect(summarizeSnapshots([
    { source: "xml", status: "success", recordCount: 348 },
    { source: "api", status: "success", recordCount: 356 },
    { source: "site", status: "success", recordCount: 348 },
  ])).toEqual({ xml: 348, api: 356, site: 348, apiOnly: 8, xmlOnly: 0, siteOnly: 0 });
});

test("filters issue rows by object ID and selected source mismatch", () => {
  expect(filterIssues([
    { canonicalId: "140742249", ruleCode: "api-not-in-xml" },
    { canonicalId: "139063232", ruleCode: "xml-not-in-api" },
  ], { query: "0742", ruleCode: "api-not-in-xml" })).toEqual([
    { canonicalId: "140742249", ruleCode: "api-not-in-xml" },
  ]);
});

test("counts actual directional differences instead of subtracting source totals", () => {
  expect(summarizeIssues([
    { canonicalId: "1", ruleCode: "api-not-in-xml" },
    { canonicalId: "2", ruleCode: "api-not-in-xml" },
    { canonicalId: "3", ruleCode: "xml-not-in-api" },
  ])).toEqual({ apiOnly: 2, xmlOnly: 1, siteOnly: 0, xmlOnlySite: 0 });
});

test("formats audit timestamps in Moscow time on both server and browser", () => {
  expect(formatMoscowDate(new Date("2026-09-21T21:07:01.000Z"))).toBe("22.09.2026, 00:07:01");
});
