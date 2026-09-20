import { expect, test } from "vitest";

import { readControlConfig } from "../src/lib/config";

const validEnvironment = {
  CONTROL_DATABASE_URL: "postgresql://control:pw@db.example/control",
  SITE_READONLY_DATABASE_URL: "postgresql://reader:pw@db.example/site",
  CONTROL_ORIGIN: "https://control.nedvizhimostdoneck.ru",
  TOPNLAB_BASE_URL: "https://agencies-p.topnlab.ru",
  TOPNLAB_KEY: "test-key",
  TOPNLAB_FEED_URL: "https://example.test/feed.xml",
  CONTROL_ADMIN_USERNAME: "owner",
  CONTROL_ADMIN_PASSWORD_HASH: "scrypt$16384$8$1$salt$hash",
  CONTROL_SESSION_SECRET: "12345678901234567890123456789012",
};

test("rejects a missing control database URL", () => {
  const { CONTROL_DATABASE_URL: _unused, ...environment } = validEnvironment;

  expect(() => readControlConfig(environment)).toThrow("CONTROL_DATABASE_URL");
});

test("accepts the separate database URLs and exact HTTPS origin", () => {
  const config = readControlConfig(validEnvironment);

  expect(config.origin).toBe("https://control.nedvizhimostdoneck.ru");
  expect(config.allowedIps).toEqual([]);
});

test("rejects an origin with a path", () => {
  expect(() => readControlConfig({ ...validEnvironment, CONTROL_ORIGIN: "https://control.nedvizhimostdoneck.ru/login" }))
    .toThrow("CONTROL_ORIGIN");
});
