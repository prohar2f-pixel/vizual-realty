import { expect, test } from "vitest";
import { propertyContentUpdate } from "../src/lib/topnlab/content";

test("content sync updates only address and description", () => {
  expect(
    propertyContentUpdate({
      region: "ДНР",
      city: "Донецк",
      street: "ул. Мира",
      house: "д. 7",
      description: "Строка 1<br />Строка 2",
      price: 9_999_999,
    }),
  ).toEqual({
    address: "ДНР, Донецк, ул. Мира, д. 7",
    description: "Строка 1\nСтрока 2",
  });
});
