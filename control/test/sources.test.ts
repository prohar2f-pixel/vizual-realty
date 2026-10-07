import { expect, test } from "vitest";

import { readTopnlabAll, readTopnlabApi, readTopnlabEntities, readTopnlabInventory } from "../src/lib/sources/topnlab-api";
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

test("selects objects in advertising instead of the unrelated service feed flag", async () => {
  let requestedUrl = "";

  await readTopnlabApi(config, async (input) => {
    requestedUrl = input;
    return Response.json(["138189643"]);
  });

  const query = new URL(requestedUrl).searchParams;
  expect(query.get("in_ad")).toBe("true");
  expect(query.has("is_feed")).toBe(false);
  expect(query.has("deal_state")).toBe(false);
});

test("loads every sale object without applying the advertising filter", async () => {
  let requestedUrl = "";

  const result = await readTopnlabAll(config, async (input) => {
    requestedUrl = input;
    return Response.json(["1", "2"]);
  });

  const query = new URL(requestedUrl).searchParams;
  expect(query.get("action")).toBe("sale");
  expect(query.has("in_ad")).toBe(false);
  expect(result.source).toBe("api_all");
  expect(result.ids).toEqual(["1", "2"]);
});

test("loads safe diagnostic fields and the responsible manager for selected Topnlab IDs", async () => {
  const result = await readTopnlabEntities(config, ["138189643"], async () => Response.json({
    "138189643": {
      id: 138189643,
      is_feed: true,
      deal_state: "ad",
      in_ad: false,
      realty_type: "flat",
      user: { name: "Елена Аянот" },
      city_name: "Донецк",
      district_name: "Киевский",
      street_name: "Артёма",
      house: "15",
      mydescription: "Описание объекта",
      price: 5700000,
      area_common: 71.2,
      area_land: 0,
      rooms: 3,
      floor: 10,
      floors: 10,
      photos: [{ id: 1 }, { id: 2 }],
    },
  }));

  expect(result.rawEntities.get("138189643")).toEqual({
    agentName: "Елена Аянот",
    cityName: "Донецк",
    districtName: "Киевский",
    hasAddress: true,
    hasDescription: true,
    hasPrice: true,
    realtyType: "flat",
    dealState: "ad",
    inAd: false,
    area: 71.2,
    landArea: undefined,
    rooms: 3,
    floor: 10,
    floors: 10,
    photoCount: 2,
  });
});

test("waits between Topnlab entity batches and verifies every requested entity", async () => {
  const requestedIds = Array.from({ length: 301 }, (_, index) => String(index + 1));
  const waits: number[] = [];
  let calls = 0;

  const result = await readTopnlabEntities(
    config,
    requestedIds,
    async (input) => {
      calls += 1;
      const ids = new URL(input).searchParams.get("id")!.split(",");
      return Response.json(Object.fromEntries(ids.map((id) => [id, { id }])));
    },
    async (milliseconds) => { waits.push(milliseconds); },
  );

  expect(calls).toBe(2);
  expect(waits).toEqual([6000]);
  expect(result.rawEntities.size).toBe(301);
});

test("loads a rate-limited inventory with all objects, advertised IDs, and diagnostics", async () => {
  const waits: number[] = [];
  const requested: string[] = [];
  const fetcher = async (input: string) => {
    requested.push(input);
    const url = new URL(input);
    if (url.pathname.endsWith("/get-ids")) {
      return Response.json(url.searchParams.has("in_ad") ? ["2"] : ["1", "2"]);
    }
    const ids = url.searchParams.get("id")!.split(",");
    return Response.json(Object.fromEntries(ids.map((id) => [id, {
      id, deal_state: "ad", in_ad: id === "2", realty_type: "flat",
      price: 100, photos: [{}], city_name: "Донецк", area_common: 40,
      rooms: 1, floor: 1, floors: 5, user: { name: "Менеджер" },
    }])));
  };

  const result = await readTopnlabInventory(config, fetcher, async (milliseconds) => { waits.push(milliseconds); });

  expect(requested).toHaveLength(3);
  expect(waits).toEqual([6000, 6000]);
  expect(result.all.source).toBe("api_all");
  expect(result.all.rawEntities.size).toBe(2);
  expect(result.advertised.ids).toEqual(["2"]);
});

test("uses only published Property IDs from the site query", async () => {
  const result = await readSitePublishedIds({
    query: async () => ({ rows: [{ id: "140832382" }] }),
  });

  expect(result.ids).toEqual(["140832382"]);
  expect(result.source).toBe("site");
});

test("keeps the site agent name alongside a published property ID", async () => {
  const result = await readSitePublishedIds({
    query: async () => ({ rows: [{ id: "140832382", agentName: "Аянот Елена" }] }),
  });

  expect(result.rawEntities.get("140832382")).toEqual({ agentName: "Аянот Елена" });
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
