import { expect, test } from "vitest";

import prismaConfig from "../prisma.config";

test("allows Prisma client generation before production environment variables exist", () => {
  expect(prismaConfig.datasource?.url).toMatch(/^postgresql:\/\//);
});
