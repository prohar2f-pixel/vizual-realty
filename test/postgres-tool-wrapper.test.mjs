import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  parseReleaseCommand,
  runReleaseAction,
} from "../scripts/run-postgres-tool.mjs";

const temporaryDirectories = [];

function releaseFixture() {
  const root = mkdtempSync(join(tmpdir(), "vizual-release-"));
  temporaryDirectories.push(root);
  const envFile = join(root, ".env");
  const backupOutput = join(root, "backups", "database.dump");
  mkdirSync(join(root, "backups"));
  writeFileSync(
    envFile,
    [
      'DATABASE_URL="postgresql://release:p%40ss@db.internal:6432/vizual?schema=public"',
      'TOPNLAB_KEY="fixture-topnlab-secret"',
      'ADMIN_SESSION_SECRET="fixture-session-secret"',
      'ADMIN_PASSWORD_HASH="fixture-password-hash"',
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  chmodSync(envFile, 0o600);
  return { root, envFile, backupOutput };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("fixed database release command", () => {
  test("rejects unknown actions, extra options, and positional database URLs", () => {
    expect(() => parseReleaseCommand(["unknown"])).toThrow("unknown release action");
    expect(() =>
      parseReleaseCommand(["deploy-fresh", "--host=db.internal"]),
    ).toThrow("does not accept extra arguments");
    expect(() =>
      parseReleaseCommand([
        "upgrade-existing",
        "postgresql://user:secret@db.internal/vizual",
      ]),
    ).toThrow("backup output must be a filesystem path");
    expect(() =>
      parseReleaseCommand(["upgrade-existing", "backup.dump", "--port=6432"]),
    ).toThrow("requires exactly one backup output path");
  });

  test("runs the existing upgrade with exact args and minimal child environments", async () => {
    const fixture = releaseFixture();
    const calls = [];
    const sourceEnvironment = {
      PATH: "safe-test-path",
      PGHOSTADDR: "inherited-host-must-not-pass",
      PGSERVICE: "inherited-service-must-not-pass",
      TOPNLAB_KEY: "inherited-topnlab-must-not-pass",
      ADMIN_SESSION_SECRET: "inherited-session-must-not-pass",
      ADMIN_PASSWORD_HASH: "inherited-hash-must-not-pass",
    };

    await runReleaseAction({
      action: "upgrade-existing",
      backupOutput: fixture.backupOutput,
      envFile: fixture.envFile,
      projectRoot: fixture.root,
      sourceEnvironment,
      async runner(call) {
        calls.push(structuredClone(call));
        if (calls.length === 1) {
          writeFileSync(fixture.backupOutput, "non-empty-backup");
          writeFileSync(
            fixture.envFile,
            'DATABASE_URL="postgresql://changed:changed@other.invalid/other"\n',
            { mode: 0o600 },
          );
        }
      },
    });

    expect(calls.map(({ tool }) => tool)).toEqual([
      "pg_dump",
      "psql",
      "prisma",
      "prisma",
      "tsx",
      "tsx",
    ]);
    expect(calls[0].args).toEqual([
      "--format=custom",
      `--file=${fixture.backupOutput}`,
    ]);
    expect(calls[1].args).toEqual([
      "-X",
      "--set",
      "ON_ERROR_STOP=1",
      "--file",
      join(fixture.root, "scripts", "preflight-admin-baseline.sql"),
    ]);
    expect(calls[2].args).toEqual([
      join(fixture.root, "node_modules", "prisma", "build", "index.js"),
      "--config",
      join(fixture.root, "scripts", "prisma-release.config.ts"),
      "migrate",
      "resolve",
      "--applied",
      "20260710000000_initial_catalog_baseline",
    ]);
    expect(calls[3].args).toEqual([
      join(fixture.root, "node_modules", "prisma", "build", "index.js"),
      "--config",
      join(fixture.root, "scripts", "prisma-release.config.ts"),
      "migrate",
      "deploy",
    ]);
    expect(calls[4].args).toEqual([
      join(fixture.root, "node_modules", "tsx", "dist", "cli.mjs"),
      join(fixture.root, "scripts", "seed-admin-content.ts"),
    ]);
    expect(calls[5].args).toEqual([
      join(fixture.root, "node_modules", "tsx", "dist", "cli.mjs"),
      join(fixture.root, "scripts", "seed-admin-content.ts"),
    ]);

    for (const call of calls) {
      expect(call.env).not.toHaveProperty("PGHOSTADDR");
      expect(call.env).not.toHaveProperty("PGSERVICE");
      expect(call.env).not.toHaveProperty("TOPNLAB_KEY");
      expect(call.env).not.toHaveProperty("ADMIN_SESSION_SECRET");
      expect(call.env).not.toHaveProperty("ADMIN_PASSWORD_HASH");
    }

    for (const call of calls.slice(0, 2)) {
      expect(call.env).toMatchObject({
        PATH: "safe-test-path",
        PGHOST: "db.internal",
        PGPORT: "6432",
        PGDATABASE: "vizual",
        PGUSER: "release",
        PGPASSWORD: "p@ss",
        PGOPTIONS: "-c search_path=public",
      });
      expect(call.env).not.toHaveProperty("DATABASE_URL");
    }

    for (const call of calls.slice(2)) {
      expect(call.env).toEqual({
        PATH: "safe-test-path",
        DATABASE_URL:
          "postgresql://release:p%40ss@db.internal:6432/vizual?schema=public",
      });
    }
  });

  test("fresh deploy runs only migrate deploy and the idempotent seed", async () => {
    const fixture = releaseFixture();
    const calls = [];

    await runReleaseAction({
      action: "deploy-fresh",
      envFile: fixture.envFile,
      projectRoot: fixture.root,
      sourceEnvironment: { PATH: "safe-test-path", PGHOSTADDR: "blocked" },
      async runner(call) {
        calls.push(call);
      },
    });

    expect(calls.map(({ tool, args }) => ({ tool, args }))).toEqual([
      {
        tool: "prisma",
        args: [
          join(fixture.root, "node_modules", "prisma", "build", "index.js"),
          "--config",
          join(fixture.root, "scripts", "prisma-release.config.ts"),
          "migrate",
          "deploy",
        ],
      },
      {
        tool: "tsx",
        args: [
          join(fixture.root, "node_modules", "tsx", "dist", "cli.mjs"),
          join(fixture.root, "scripts", "seed-admin-content.ts"),
        ],
      },
      {
        tool: "tsx",
        args: [
          join(fixture.root, "node_modules", "tsx", "dist", "cli.mjs"),
          join(fixture.root, "scripts", "seed-admin-content.ts"),
        ],
      },
    ]);
    expect(calls.every(({ env }) => !("PGHOSTADDR" in env))).toBe(true);
  });
});
