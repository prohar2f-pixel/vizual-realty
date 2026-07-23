import { expect, test } from "vitest";
import { splitPropertyDescription } from "../src/components/PropertyDescription";

test("splits blank-line-separated blocks into compact paragraphs", () => {
  expect(
    splitPropertyDescription(
      "Первый блок\nпродолжение\n\n\nВторой блок\n\n  Третий блок  ",
    ),
  ).toEqual([
    "Первый блок\nпродолжение",
    "Второй блок",
    "Третий блок",
  ]);
});
