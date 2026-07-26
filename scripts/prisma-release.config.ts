import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  schema: join(projectRoot, "prisma", "schema.prisma"),
  migrations: {
    path: join(projectRoot, "prisma", "migrations"),
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
