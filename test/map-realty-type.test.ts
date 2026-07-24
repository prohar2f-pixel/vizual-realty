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
