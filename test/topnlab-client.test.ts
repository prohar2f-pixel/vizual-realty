import { describe, expect, test } from "vitest";
import { normalizeEntitiesResponse } from "../src/lib/topnlab/client";

describe("normalizeEntitiesResponse", () => {
  test("accepts the object response returned by Topnlab for a batch", () => {
    const first = { id: "101", title: "Квартира" };
    const second = { id: "102", title: "Дом" };

    expect(normalizeEntitiesResponse({ "101": first, "102": second })).toEqual([first, second]);
  });
});
