import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { afterEach, describe, expect, it } from "vitest";
import {
  isSupportedAdminScryptHash,
  verifyAdminPassword,
} from "../src/lib/admin/auth";

const TEST_PASSWORD = "correct horse battery staple";
const ENV_KEYS = [
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD_HASH",
  "ADMIN_SESSION_SECRET",
  "SITE_ORIGIN",
] as const;

const originalEnvironment = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("admin password environment writer", () => {
  it("writes a scrypt hash that survives the real Next.js env loader", async () => {
    const directory = mkdtempSync(join(tmpdir(), "vizual-admin-env-"));
    const script = resolve("scripts/set-admin-password.mjs");

    try {
      writeFileSync(
        join(directory, ".env"),
        [
          'ADMIN_USERNAME="admin"',
          'ADMIN_SESSION_SECRET="abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"',
          'SITE_ORIGIN="https://example.test"',
          "",
        ].join("\n"),
        { mode: 0o600 },
      );

      const result = spawnSync(process.execPath, [script], {
        cwd: directory,
        encoding: "utf8",
        env: {
          ...process.env,
          ADMIN_PASSWORD_PLAIN: TEST_PASSWORD,
        },
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe("admin_password_hash_configured");
      expect(result.stdout).not.toContain(TEST_PASSWORD);
      expect(result.stderr).toBe("");

      for (const key of ENV_KEYS) delete process.env[key];
      loadEnvConfig(
        directory,
        false,
        { info() {}, error() {} },
        true,
      );

      const loadedHash = process.env.ADMIN_PASSWORD_HASH ?? "";
      expect(isSupportedAdminScryptHash(loadedHash)).toBe(true);
      await expect(verifyAdminPassword(TEST_PASSWORD, loadedHash)).resolves.toBe(
        true,
      );
      expect(readFileSync(join(directory, ".env"), "utf8")).not.toContain(
        TEST_PASSWORD,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
