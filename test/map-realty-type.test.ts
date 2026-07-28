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

test("maps Topnlab photo objects to the best available image URLs", () => {
  expect(
    mapTopnlabEntity({
      ...entity,
      photos: [
        {
          large_hash: "https://files.topnlab.ru/large.jpg",
          medium_hash: "https://files.topnlab.ru/medium.jpg",
          original: "https://files.topnlab.ru/original.jpg",
        },
        { original: "https://files.topnlab.ru/second.jpg" },
        null,
      ],
    }).photos,
  ).toEqual([
    "https://files.topnlab.ru/large.jpg",
    "https://files.topnlab.ru/second.jpg",
  ]);
});

test("normalizes Topnlab room codes used by real entities", () => {
  const mapped = mapTopnlabEntity({
    ...entity,
    title: undefined,
    rooms: 40,
  });

  expect(mapped.rooms).toBe(4);
  expect(mapped.title).toContain("4-комн. квартира");
});

test("maps the floor and building floor count from Topnlab", () => {
  const mapped = mapTopnlabEntity({
    ...entity,
    floor: 2,
    floors: 9,
  });

  expect(mapped.floor).toBe(2);
  expect(mapped.floors).toBe(9);
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
