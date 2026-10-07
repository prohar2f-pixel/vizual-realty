import { expect, test } from "vitest";

import packageJson from "../package.json";

test("generates the Prisma client after a clean dependency install", () => {
  expect(packageJson.scripts.postinstall).toBe("prisma generate");
});
