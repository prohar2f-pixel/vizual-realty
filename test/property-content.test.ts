import { describe, expect, test } from "vitest";
import {
  extractTopnlabDistrict,
  formatTopnlabAddress,
  normalizePropertyDescription,
  normalizeStoredPropertyDistrict,
} from "../src/lib/property-content";

describe("normalizePropertyDescription", () => {
  test("converts CRM line breaks to clean text paragraphs", () => {
    expect(
      normalizePropertyDescription(
        "\u041f\u0435\u0440\u0432\u0430\u044f \u0441\u0442\u0440\u043e\u043a\u0430<br />\u0412\u0442\u043e\u0440\u0430\u044f \u0441\u0442\u0440\u043e\u043a\u0430<br><br/>\u0422\u0435\u043b\u0435\u0444\u043e\u043d&nbsp;\u0430\u0433\u0435\u043d\u0442\u0430",
      ),
    ).toBe("\u041f\u0435\u0440\u0432\u0430\u044f \u0441\u0442\u0440\u043e\u043a\u0430\n\u0412\u0442\u043e\u0440\u0430\u044f \u0441\u0442\u0440\u043e\u043a\u0430\n\n\u0422\u0435\u043b\u0435\u0444\u043e\u043d \u0430\u0433\u0435\u043d\u0442\u0430");
  });

  test("removes remaining markup without executing it", () => {
    expect(
      normalizePropertyDescription(
        "<p>\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 &amp; \u0434\u0435\u0442\u0430\u043b\u0438</p><script>alert(1)</script>",
      ),
    ).toBe("\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 & \u0434\u0435\u0442\u0430\u043b\u0438");
  });

  test("turns entity-encoded breaks into newlines and removes encoded tags", () => {
    expect(
      normalizePropertyDescription(
        "\u0422\u0435\u043a\u0441\u0442&lt;br&gt;\u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0435\u043d\u0438\u0435&lt;br /&gt;&lt;strong&gt;\u0431\u0435\u0437 \u0440\u0430\u0437\u043c\u0435\u0442\u043a\u0438&lt;/strong&gt;",
      ),
    ).toBe("\u0422\u0435\u043a\u0441\u0442\n\u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0435\u043d\u0438\u0435\n\u0431\u0435\u0437 \u0440\u0430\u0437\u043c\u0435\u0442\u043a\u0438");
  });

  test("preserves invalid numeric entities without throwing", () => {
    expect(() => normalizePropertyDescription("\u0422\u0435\u043a\u0441\u0442 &#1114112;")).not.toThrow();
    expect(normalizePropertyDescription("\u0422\u0435\u043a\u0441\u0442 &#1114112;")).toBe(
      "\u0422\u0435\u043a\u0441\u0442 &#1114112;",
    );
  });

  test("returns undefined for empty markup", () => {
    expect(normalizePropertyDescription("<br><p> </p>")).toBeUndefined();
  });
});

describe("formatTopnlabAddress", () => {
  test("adds readable prefixes to plain structured address parts", () => {
    expect(
      formatTopnlabAddress({
        region: "Донецкая Народная Республика",
        city: "Донецк",
        city_district: "Пролетарский",
        street: "Раздольная",
        house: "26",
      }),
    ).toBe(
      "Донецкая Народная Республика, г. Донецк, Пролетарский р-н, ул. Раздольная, д. 26",
    );
  });

  test("expands the shortened Donetsk People's Republic region name", () => {
    expect(
      formatTopnlabAddress({
        region: "Донецкая Народная",
        city: "Донецк",
        city_district: "Пролетарский",
        street: "Раздольная",
        house: "26",
      }),
    ).toBe(
      "Донецкая Народная Республика, г. Донецк, Пролетарский р-н, ул. Раздольная, д. 26",
    );
  });

  test("builds the CRM address from structured components", () => {
    expect(
      formatTopnlabAddress({
        region: "\u0414\u043e\u043d\u0435\u0446\u043a\u0430\u044f \u041d\u0430\u0440\u043e\u0434\u043d\u0430\u044f \u0420\u0435\u0441\u043f.",
        city: "\u0433. \u0414\u043e\u043d\u0435\u0446\u043a",
        city_district: "\u041f\u0440\u043e\u043b\u0435\u0442\u0430\u0440\u0441\u043a\u0438\u0439 \u0440-\u043d",
        street: "\u0443\u043b. \u0420\u0430\u0437\u0434\u043e\u043b\u044c\u043d\u0430\u044f",
        house: "\u0434. 26",
        address: "\u0420\u0430\u0437\u0434\u043e\u043b\u044c\u043d\u0430\u044f \u0443\u043b., 26",
      }),
    ).toBe(
      "\u0414\u043e\u043d\u0435\u0446\u043a\u0430\u044f \u041d\u0430\u0440\u043e\u0434\u043d\u0430\u044f \u0420\u0435\u0441\u043f\u0443\u0431\u043b\u0438\u043a\u0430, \u0433. \u0414\u043e\u043d\u0435\u0446\u043a, \u041f\u0440\u043e\u043b\u0435\u0442\u0430\u0440\u0441\u043a\u0438\u0439 \u0440-\u043d, \u0443\u043b. \u0420\u0430\u0437\u0434\u043e\u043b\u044c\u043d\u0430\u044f, \u0434. 26",
    );
  });

  test("supports nested Topnlab values and removes duplicates", () => {
    expect(
      formatTopnlabAddress({
        region: { name: "\u0414\u041d\u0420" },
        city: { name: "\u0414\u043e\u043d\u0435\u0446\u043a" },
        district: { name: "\u0414\u043e\u043d\u0435\u0446\u043a" },
        street: { name: "\u0410\u0440\u0442\u0451\u043c\u0430 \u0443\u043b." },
        house_number: "15",
      }),
    ).toBe("\u0414\u041d\u0420, \u0433. \u0414\u043e\u043d\u0435\u0446\u043a, \u0443\u043b. \u0410\u0440\u0442\u0451\u043c\u0430, \u0434. 15");
  });

  test("falls back to the ready or legacy address", () => {
    expect(
      formatTopnlabAddress({
        full_address: "\u0433. \u0414\u043e\u043d\u0435\u0446\u043a, \u0443\u043b. \u041c\u0438\u0440\u0430, \u0434. 7",
      }),
    ).toBe("\u0433. \u0414\u043e\u043d\u0435\u0446\u043a, \u0443\u043b. \u041c\u0438\u0440\u0430, \u0434. 7");
    expect(formatTopnlabAddress({ address: "\u041c\u0438\u0440\u0430 \u0443\u043b., 7" })).toBe(
      "\u041c\u0438\u0440\u0430 \u0443\u043b., 7",
    );
  });

  test("prefers a complete ready address over partial structured fields", () => {
    expect(
      formatTopnlabAddress({
        region: "\u0414\u041d\u0420",
        city: "\u0414\u043e\u043d\u0435\u0446\u043a",
        full_address: "\u0414\u041d\u0420, \u0414\u043e\u043d\u0435\u0446\u043a, \u0443\u043b. \u041c\u0438\u0440\u0430, \u0434. 7",
      }),
    ).toBe("\u0414\u041d\u0420, \u0414\u043e\u043d\u0435\u0446\u043a, \u0443\u043b. \u041c\u0438\u0440\u0430, \u0434. 7");
  });
});

describe("extractTopnlabDistrict", () => {
  test("uses the city district instead of a city-like generic district", () => {
    expect(
      extractTopnlabDistrict({
        city: "Донецк",
        district: "Донецк г.",
        city_district: "Пролетарский",
      }),
    ).toBe("Пролетарский р-н");
  });

  test("does not treat the city as a district", () => {
    expect(
      extractTopnlabDistrict({
        city: { name: "Донецк" },
        district: { name: "Донецк г." },
      }),
    ).toBeUndefined();
  });

  test("supports nested district values", () => {
    expect(
      extractTopnlabDistrict({
        city: { name: "Донецк" },
        city_district_name: { name: "Кировский район" },
      }),
    ).toBe("Кировский район");
  });
});

describe("normalizeStoredPropertyDistrict", () => {
  test("keeps real district labels", () => {
    expect(normalizeStoredPropertyDistrict("Пролетарский р-н")).toBe(
      "Пролетарский р-н",
    );
    expect(normalizeStoredPropertyDistrict("Кировский район")).toBe(
      "Кировский район",
    );
  });

  test("rejects legacy city values and ambiguous plain labels", () => {
    expect(normalizeStoredPropertyDistrict("Донецк г.")).toBeUndefined();
    expect(normalizeStoredPropertyDistrict("Макеевка г.")).toBeUndefined();
    expect(normalizeStoredPropertyDistrict("Центр")).toBeUndefined();
  });
});
