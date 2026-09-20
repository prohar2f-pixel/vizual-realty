import { expect, test } from "vitest";

import { evaluateSetDifferences } from "../src/lib/audit/rules";
import type { SourceResult } from "../src/lib/sources/types";

function source(source: SourceResult["source"], ids: string[]): SourceResult {
  return { source, ids, rawEntities: new Map(), startedAt: new Date(0), finishedAt: new Date(1), idsSha256: "hash" };
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
