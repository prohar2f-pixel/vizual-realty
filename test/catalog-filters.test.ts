import { describe, expect, test } from "vitest";
import { buildCatalogWhere } from "../src/lib/catalog-filters";

describe("buildCatalogWhere", () => {
  test("combines the approved catalog filters", () => {
    expect(
      buildCatalogWhere({
        objectType: "house",
        city: "Донецк",
        district: "Киевский р-н",
        rooms: "4",
        priceMin: "2000000",
        priceMax: "5000000",
      }),
    ).toEqual({
      isFeed: true,
      objectType: "house",
      city: "Донецк",
      district: "Киевский р-н",
      rooms: { gte: 4 },
      price: { gte: 2000000, lte: 5000000 },
    });
  });

  test("ignores unsupported types, orphan districts, and invalid prices", () => {
    expect(
      buildCatalogWhere({
        objectType: "commercial",
        district: "Центральный р-н",
        priceMin: "-1",
        priceMax: "не число",
      }),
    ).toEqual({ isFeed: true });
  });

  test("keeps either valid inclusive price bound", () => {
    expect(buildCatalogWhere({ priceMin: "1000000" })).toEqual({
      isFeed: true,
      price: { gte: 1000000 },
    });
    expect(buildCatalogWhere({ priceMax: "3000000" })).toEqual({
      isFeed: true,
      price: { lte: 3000000 },
    });
  });

  test("ignores unsupported room values", () => {
    expect(buildCatalogWhere({ rooms: "studio" })).toEqual({ isFeed: true });
    expect(buildCatalogWhere({ rooms: "0" })).toEqual({ isFeed: true });
  });

  test("finds a property by its Topnlab article or internal ID", () => {
    expect(buildCatalogWhere({ article: "139373401" })).toEqual({
      isFeed: true,
      OR: [{ id: "139373401" }, { shortId: 139373401 }],
    });
  });

  test("ignores a non-numeric article", () => {
    expect(buildCatalogWhere({ article: "дом 15" })).toEqual({ isFeed: true });
  });
});
