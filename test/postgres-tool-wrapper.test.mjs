import { describe, expect, test } from "vitest";
import { buildPostgresEnvironment } from "../scripts/run-postgres-tool.mjs";

describe("PostgreSQL release tool environment", () => {
  test("derives libpq variables from the protected Prisma URL", () => {
    const environment = buildPostgresEnvironment(
      "postgresql://release%40user:p%40ss@db.internal:6432/vizual%20realty?schema=public&sslmode=require",
      {
        DATABASE_URL: "must-not-reach-child",
        PGSERVICE: "unrelated-manual-service",
        SAFE_FLAG: "kept",
      },
    );

    expect(environment).toMatchObject({
      PGHOST: "db.internal",
      PGPORT: "6432",
      PGDATABASE: "vizual realty",
      PGUSER: "release@user",
      PGPASSWORD: "p@ss",
      PGSSLMODE: "require",
      SAFE_FLAG: "kept",
    });
    expect(environment).not.toHaveProperty("DATABASE_URL");
    expect(environment).not.toHaveProperty("PGSERVICE");
  });

  test("rejects a schema that the exact public preflight cannot inspect", () => {
    expect(() =>
      buildPostgresEnvironment(
        "postgresql://release:secret@db.internal/vizual?schema=private",
      ),
    ).toThrow("supports only the public database schema");
  });

  test("does not repeat a malformed secret URL in its error", () => {
    const secret = "not-a-url-with-password=do-not-print";

    expect(() => buildPostgresEnvironment(secret)).toThrow(
      "DATABASE_URL is not a valid URL",
    );
    try {
      buildPostgresEnvironment(secret);
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
