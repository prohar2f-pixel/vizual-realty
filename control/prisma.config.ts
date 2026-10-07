import { defineConfig } from "prisma/config";

const generateOnlyUrl = "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.CONTROL_DATABASE_URL ?? generateOnlyUrl,
  },
});
