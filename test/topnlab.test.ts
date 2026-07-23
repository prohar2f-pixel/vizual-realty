import { expect, test } from "vitest";
import entity from "./fixtures/topnlab-entity.json";
import { mapTopnlabEntity } from "../src/lib/topnlab/map";

test("normalizes Topnlab property content", () => {
  const mapped = mapTopnlabEntity(entity);

  expect(mapped.address).toBe(
    "Донецкая Народная Республика, г. Донецк, Пролетарский р-н, ул. Раздольная, д. 26",
  );
  expect(mapped.district).toBe("Пролетарский р-н");
  expect(mapped.description).toBe("Первая строка\nВторая строка");
});
