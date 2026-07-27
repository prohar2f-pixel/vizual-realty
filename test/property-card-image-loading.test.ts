import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

test("defers offscreen property photos", async () => {
  const source = await readFile(
    new URL("../src/components/PropertyCard.tsx", import.meta.url),
    "utf8",
  );

  expect(source).toMatch(/<img\s+src=\{photo\}[\s\S]*?loading="lazy"/);
  expect(source).toMatch(/<img\s+src=\{photo\}[\s\S]*?decoding="async"/);
});
