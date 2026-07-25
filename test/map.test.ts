import { test, expect } from "vitest";
import entity from "./fixtures/topnlab-entity.json";
import { mapTopnlabEntity } from "../src/lib/topnlab/map";

test("preserves a Topnlab employee ID as a string", () => {
  const p = mapTopnlabEntity({
    ...entity,
    agent: {
      ...entity.agent,
      id: 296892,
      name: "Аянот Елена",
    },
  });

  expect(p.agent?.id).toBe("296892");
  expect(p.agent?.name).toBe("Аянот Елена");
});

test("маппит объект Topnlab в нашу модель", () => {
  const p = mapTopnlabEntity(entity);
  expect(p.id).toBe("1233");
  expect(p.shortId).toBe(53020);
  expect(p.price).toBe(4500000);
  expect(p.city).toBe("Донецк");
  expect(p.photos).toHaveLength(2);
  expect(p.agent?.name).toBe("Ольга Петрова");
});
