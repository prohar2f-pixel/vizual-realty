import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const readProjectFile = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("legacy database baseline preflight", () => {
  const sql = readProjectFile("scripts/preflight-admin-baseline.sql");

  test("compares the exact legacy columns, types, nullability, and defaults", () => {
    expect(sql).toContain("format_type(");
    expect(sql).toContain("pg_get_expr(");
    expect(sql).toContain("text[]");
    expect(sql).toContain("unexpected column");
  });

  test("checks exact key columns and an empty migration history", () => {
    expect(sql).toContain("conkey");
    expect(sql).toContain("confkey");
    expect(sql).toContain('public."_prisma_migrations"');
    expect(sql).toContain("migration history is not empty");
  });
});

describe("database release runbook", () => {
  const readme = readProjectFile("README.md");

  test("keeps one protected DATABASE_URL in the environment for every database tool", () => {
    expect(readme).toContain("set -Eeuo pipefail");
    expect(readme).toContain("set +x");
    expect(readme).toContain("node scripts/run-postgres-tool.mjs pg_dump");
    expect(readme).toContain("node scripts/run-postgres-tool.mjs psql");
    expect(readme).toContain("assert_database_unchanged");
    expect(readme).toContain("unset DATABASE_URL DB_FINGERPRINT");
    expect(readme).not.toContain("PGSERVICE=");
    expect(readme).not.toContain("PGPASSFILE=");
  });
});
