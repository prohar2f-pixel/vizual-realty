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

  test("uses one fixed orchestrator command after dependency install and build", () => {
    expect(readme).toContain("set -Eeuo pipefail");
    expect(readme).toContain("set +x");
    expect(readme).toContain(
      'node scripts/run-postgres-tool.mjs upgrade-existing "$BACKUP_DIR/database.dump"',
    );
    expect(readme.indexOf("npm ci")).toBeLessThan(
      readme.indexOf("run-postgres-tool.mjs upgrade-existing"),
    );
    expect(readme.indexOf("npm run build")).toBeLessThan(
      readme.indexOf("run-postgres-tool.mjs upgrade-existing"),
    );
    expect(readme).not.toContain("set -a");
    expect(readme).not.toContain(". ./.env");
    expect(readme).not.toContain("PGSERVICE=");
    expect(readme).not.toContain("PGPASSFILE=");
  });
});
