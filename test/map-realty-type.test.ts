import { expect, test } from "vitest";
import entity from "./fixtures/topnlab-entity.json";
import { mapTopnlabEntity } from "../src/lib/topnlab/map";

test("maps the real Topnlab realty_type field", () => {
  const { object_type: _objectType, ...realEntity } = entity;

  const mapped = mapTopnlabEntity({
    ...realEntity,
    realty_type: "flat",
  });

  expect(mapped.objectType).toBe("flat");
});

test("maps Topnlab deal_type when deal is omitted", () => {
  const { deal: _deal, ...realEntity } = entity;

  expect(
    mapTopnlabEntity({
      ...realEntity,
      deal_type: "rent",
    }).deal,
  ).toBe("rent");
});

test("uses Topnlab display_title before generating a title", () => {
  const { title: _title, ...realEntity } = entity;

  expect(
    mapTopnlabEntity({
      ...realEntity,
      display_title: "Готовое название из Topnlab",
    }).title,
  ).toBe("Готовое название из Topnlab");
});

test("builds a readable title when Topnlab omits title", () => {
  const { title: _title, object_type: _objectType, ...realEntity } = entity;

  const mapped = mapTopnlabEntity({
    ...realEntity,
    realty_type: "flat",
    region: undefined,
    city: undefined,
    city_district: undefined,
    district: undefined,
    street: "Артёма",
    house: "15",
    address: undefined,
  });

  expect(mapped.title).toBe("2-комн. квартира, ул. Артёма, д. 15");
});
