import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getEntities: vi.fn(),
  getIds: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({
  db: { property: { findMany: mocks.findMany, update: mocks.update } },
}));

vi.mock("../src/lib/topnlab/client", () => ({
  getEntities: mocks.getEntities,
  getIds: mocks.getIds,
}));

import { propertyContentUpdate } from "../src/lib/topnlab/content";
import { syncPropertyContent } from "../src/lib/topnlab/content";

beforeEach(() => {
  vi.resetAllMocks();
});

test("content sync updates only address, description, and district", () => {
  expect(
    propertyContentUpdate({
      region: "ДНР",
      city: "Донецк",
      city_district: "Киевский",
      street: "ул. Мира",
      house: "д. 7",
      description: "Строка 1<br />Строка 2",
      price: 9_999_999,
    }),
  ).toEqual({
    address: "ДНР, г. Донецк, Киевский р-н, ул. Мира, д. 7",
    description: "Строка 1\nСтрока 2",
    city: "Донецк",
    district: "Киевский р-н",
  });
});

test("content sync persists only usable address, description, and district after a bad card", async () => {
  mocks.getIds.mockImplementation(async (action: "sale" | "rent") =>
    action === "sale"
      ? ["known", "unknown", "empty", "bad", "good"]
      : ["known"],
  );
  mocks.getEntities.mockResolvedValue([
    { id: "unknown", description: "\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u043e\u0431\u044a\u0435\u043a\u0442" },
    { id: "empty", description: "<br>" },
    { id: "bad", description: "&#1114112;" },
    {
      id: "good",
      region: "\u0414\u041d\u0420",
      city: "\u0414\u043e\u043d\u0435\u0446\u043a",
      city_district: "\u041a\u0430\u043b\u0438\u043d\u0438\u043d\u0441\u043a\u0438\u0439",
      street: "\u0443\u043b. \u041c\u0438\u0440\u0430",
      house: "\u0434. 7",
      description: "\u0421\u0442\u0440\u043e\u043a\u0430 1&lt;br /&gt;\u0421\u0442\u0440\u043e\u043a\u0430 2",
      managers: ["manager-1"],
      photos: ["photo-1"],
      price: 9_999_999,
    },
  ]);
  mocks.findMany.mockResolvedValue([
    { id: "known" },
    { id: "empty" },
    { id: "bad" },
    { id: "good" },
  ]);
  mocks.update.mockResolvedValue({});

  await expect(syncPropertyContent()).resolves.toEqual({ updated: 2, skipped: 2 });
  expect(mocks.update).toHaveBeenCalledTimes(2);
  expect(mocks.update).toHaveBeenNthCalledWith(1, {
    where: { id: "bad" },
    data: { description: "&#1114112;" },
  });
  expect(mocks.update).toHaveBeenNthCalledWith(2, {
    where: { id: "good" },
    data: {
      address: "\u0414\u041d\u0420, \u0433. \u0414\u043e\u043d\u0435\u0446\u043a, \u041a\u0430\u043b\u0438\u043d\u0438\u043d\u0441\u043a\u0438\u0439 \u0440-\u043d, \u0443\u043b. \u041c\u0438\u0440\u0430, \u0434. 7",
      description: "\u0421\u0442\u0440\u043e\u043a\u0430 1\n\u0421\u0442\u0440\u043e\u043a\u0430 2",
      city: "\u0414\u043e\u043d\u0435\u0446\u043a",
      district: "\u041a\u0430\u043b\u0438\u043d\u0438\u043d\u0441\u043a\u0438\u0439 \u0440-\u043d",
    },
  });
  expect(mocks.update.mock.calls.flatMap(([{ data }]) => Object.keys(data))).toEqual([
    "description",
    "address",
    "description",
    "city",
    "district",
  ]);
});
