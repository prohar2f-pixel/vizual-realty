import { expect, test } from "vitest";

import { evaluateSetDifferences } from "../src/lib/audit/rules";
import { attachApiDiagnostics } from "../src/lib/audit/run";
import type { SourceResult } from "../src/lib/sources/types";

function source(source: SourceResult["source"], ids: string[]): SourceResult {
  return { source, ids, rawEntities: new Map(), startedAt: new Date(0), finishedAt: new Date(1), idsSha256: "hash" };
}

function completeFlat(overrides: Record<string, unknown> = {}) {
  return {
    realtyType: "flat", dealState: "ad", inAd: false,
    hasPrice: true, photoCount: 5, cityName: "Донецк", agentName: "Иван Иванов",
    area: 54, rooms: 2, floor: 3, floors: 9, landArea: undefined,
    districtName: "Киевский", hasAddress: true, hasDescription: true,
    ...overrides,
  };
}

test("reports API-only and XML-only IDs as directional differences", () => {
  const result = evaluateSetDifferences({
    xml: source("xml", ["1", "2"]),
    api: source("api", ["2", "3"]),
    site: source("site", ["1", "2"]),
  });

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({ ruleCode: "api-not-in-xml", canonicalId: "3", category: "exact" }),
    expect.objectContaining({ ruleCode: "xml-not-in-api", canonicalId: "1", category: "exact" }),
  ]));
});

test("skips comparisons that require an unavailable source", () => {
  const result = evaluateSetDifferences({ xml: source("xml", ["1"]), api: null, site: source("site", ["1"]) });
  expect(result).toEqual([]);
});

test("keeps the responsible agent from a source when a discrepancy is recorded", () => {
  const site = source("site", ["1"]);
  site.rawEntities.set("1", { agentName: "Аянот Елена" });

  const result = evaluateSetDifferences({ xml: source("xml", []), api: null, site });

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      ruleCode: "site-not-in-xml",
      evidence: expect.objectContaining({ agentName: "Аянот Елена" }),
    }),
  ]));
});

test("records Topnlab entity diagnostics for an API-to-XML discrepancy", () => {
  const api = source("api", ["138189643"]);
  api.rawEntities.set("138189643", { agentName: "Елена Аянот" });

  const result = evaluateSetDifferences({ xml: source("xml", []), api, site: null });

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({
      ruleCode: "api-not-in-xml",
      evidence: expect.objectContaining({ agentName: "Елена Аянот" }),
    }),
  ]));
});

test("attaches fetched Topnlab diagnostics before mismatch evidence is created", () => {
  const api = source("api", ["138189643"]);
  const details = source("api", ["138189643"]);
  details.rawEntities.set("138189643", { agentName: "Елена Аянот" });

  const enriched = attachApiDiagnostics(api, details);
  const result = evaluateSetDifferences({ xml: source("xml", []), api: enriched, site: null });

  expect(result[0]?.evidence).toEqual(expect.objectContaining({ agentName: "Елена Аянот" }));
});

test("reports only active CRM objects that are not in advertising", () => {
  const allApi = source("api_all", ["1", "2", "3"]);
  allApi.rawEntities.set("1", completeFlat({ dealState: "ad" }));
  allApi.rawEntities.set("2", completeFlat({ dealState: "lead" }));
  allApi.rawEntities.set("3", completeFlat({ dealState: "archive" }));

  const result = evaluateSetDifferences({ xml: null, api: source("api", []), apiAll: allApi, site: null });

  expect(result.filter((issue) => issue.ruleCode === "active-not-in-ad")).toEqual([
    expect.objectContaining({ canonicalId: "1", category: "advertising" }),
  ]);
});

test("reports every missing required flat field as a separate quality issue", () => {
  const allApi = source("api_all", ["1"]);
  allApi.rawEntities.set("1", completeFlat({
    hasPrice: false, photoCount: 0, cityName: undefined, agentName: undefined,
    area: undefined, rooms: undefined, floor: undefined, floors: undefined,
  }));

  const result = evaluateSetDifferences({ xml: null, api: source("api", ["1"]), apiAll: allApi, site: null });

  expect(result.filter((issue) => issue.category === "quality").map((issue) => issue.ruleCode).sort()).toEqual([
    "missing-agent", "missing-area", "missing-city", "missing-floor",
    "missing-floors", "missing-photos", "missing-price", "missing-rooms",
  ]);
});

test("uses property-type-specific quality rules", () => {
  const allApi = source("api_all", ["house", "land"]);
  allApi.rawEntities.set("house", completeFlat({ realtyType: "house", area: 120, landArea: undefined }));
  allApi.rawEntities.set("land", completeFlat({ realtyType: "land", area: undefined, landArea: undefined, rooms: undefined, floor: undefined, floors: undefined }));

  const result = evaluateSetDifferences({ xml: null, api: source("api", ["house", "land"]), apiAll: allApi, site: null });
  const rulesFor = (id: string) => result.filter((issue) => issue.canonicalId === id).map((issue) => issue.ruleCode);

  expect(rulesFor("house")).toContain("missing-land-area");
  expect(rulesFor("land")).toEqual(expect.arrayContaining(["missing-land-area"]));
  expect(rulesFor("land")).not.toEqual(expect.arrayContaining(["missing-area", "missing-rooms", "missing-floor", "missing-floors"]));
});

test("reports a floor that exceeds the building floor count", () => {
  const allApi = source("api_all", ["1"]);
  allApi.rawEntities.set("1", completeFlat({ floor: 12, floors: 9 }));

  const result = evaluateSetDifferences({ xml: null, api: source("api", ["1"]), apiAll: allApi, site: null });

  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({ ruleCode: "invalid-floor-range", canonicalId: "1", category: "quality" }),
  ]));
});

test("does not validate draft or archived objects unless they are advertised", () => {
  const allApi = source("api_all", ["draft", "advertised-lead"]);
  allApi.rawEntities.set("draft", completeFlat({ dealState: "lead", hasPrice: false }));
  allApi.rawEntities.set("advertised-lead", completeFlat({ dealState: "lead", inAd: true, hasPrice: false }));

  const result = evaluateSetDifferences({ xml: null, api: source("api", ["advertised-lead"]), apiAll: allApi, site: null });

  expect(result.some((issue) => issue.canonicalId === "draft")).toBe(false);
  expect(result).toEqual(expect.arrayContaining([
    expect.objectContaining({ canonicalId: "advertised-lead", ruleCode: "missing-price" }),
  ]));
});

test("reports missing recommended listing details as quality warnings", () => {
  const allApi = source("api_all", ["1"]);
  allApi.rawEntities.set("1", completeFlat({ districtName: undefined, hasAddress: false, hasDescription: false }));

  const result = evaluateSetDifferences({ xml: null, api: source("api", ["1"]), apiAll: allApi, site: null });

  expect(result.map((issue) => issue.ruleCode)).toEqual(expect.arrayContaining([
    "missing-district", "missing-address", "missing-description",
  ]));
});
