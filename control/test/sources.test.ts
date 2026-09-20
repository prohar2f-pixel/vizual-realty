import { expect, test } from "vitest";

import { readTopnlabApi } from "../src/lib/sources/topnlab-api";
import { readSitePublishedIds } from "../src/lib/sources/site-db";
import { readXmlFeed } from "../src/lib/sources/xml-feed";
import { canonicalize } from "../src/lib/audit/canonical";

const config = {
  feedUrl: "https://example.test/feed.xml",
  apiBaseUrl: "https://api.example.test",
  apiKey: "test-key",
};

test("rejects XML without nonempty offer internal-id values", async () => {
  await expect(readXmlFeed(config, async () => new Response("<offers />")))
    .rejects.toThrow("XML_FEED_EMPTY");
});

test("returns sorted unique IDs from offer internal-id attributes", async () => {
  const result = await readXmlFeed(
    config,
    async () => new Response('<yml_catalog><shop><offers><offer internal-id="2"/><offer internal-id="1"/><offer internal-id="2"/></offers></shop></yml_catalog>'),
  );

  expect(result.ids).toEqual(["1", "2"]);
  expect(result.source).toBe("xml");
});

test("rejects an object-shaped get-ids response", async () => {
  await expect(readTopnlabApi(config, async () => Response.json({ ids: ["1"] })))
    .rejects.toThrow("TOPNLAB_IDS_SHAPE");
});

test("uses only published Property IDs from the site query", async () => {
  const result = await readSitePublishedIds({
    query: async () => ({ rows: [{ id: "140832382" }] }),
  });

  expect(result.ids).toEqual(["140832382"]);
  expect(result.source).toBe("site");
});

test("does not silently join unequal source IDs", () => {
  expect(canonicalize("xml", " 140832382 ")).toEqual({
    source: "xml",
    rawId: "140832382",
    canonicalId: "140832382",
    mappingVersion: "identity-v1",
  });
  expect(canonicalize("api", "offer-140832382").canonicalId).not.toBe("140832382");
});
