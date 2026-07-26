import { Buffer } from "node:buffer";
import { describe, expect, test } from "vitest";
import { sealSession, unsealSession } from "../src/lib/admin/session";

const TEST_SECRET = "test-session-secret-that-is-not-used-anywhere-real";
const TEST_NOW = Date.parse("2026-07-26T08:00:00.000Z");
const TEST_EXPIRY = TEST_NOW + 60_000;

describe("admin session encryption", () => {
  test("round-trips the minimal admin session through AES-256-GCM", () => {
    const token = sealSession(
      { adminId: "test-admin", expiresAt: TEST_EXPIRY },
      TEST_SECRET,
      TEST_NOW,
    );

    expect(unsealSession(token, TEST_SECRET, TEST_NOW)).toEqual({
      adminId: "test-admin",
      issuedAt: TEST_NOW,
      expiresAt: TEST_EXPIRY,
      nonce: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
    });
    expect(token).not.toContain("test-admin");
  });

  test("uses a fresh IV and nonce for every sealed cookie", () => {
    const input = { adminId: "test-admin", expiresAt: TEST_EXPIRY };

    const first = sealSession(input, TEST_SECRET, TEST_NOW);
    const second = sealSession(input, TEST_SECRET, TEST_NOW);

    expect(first).not.toBe(second);
    expect(unsealSession(first, TEST_SECRET, TEST_NOW)?.nonce).not.toBe(
      unsealSession(second, TEST_SECRET, TEST_NOW)?.nonce,
    );
  });

  test("rejects a token after one encrypted byte is changed", () => {
    const token = sealSession(
      { adminId: "test-admin", expiresAt: TEST_EXPIRY },
      TEST_SECRET,
      TEST_NOW,
    );
    const [version, encoded] = token.split(".");
    const bytes = Buffer.from(encoded, "base64url");
    bytes[15] ^= 1;
    const tampered = `${version}.${bytes.toString("base64url")}`;

    expect(unsealSession(tampered, TEST_SECRET, TEST_NOW)).toBeNull();
  });

  test("rejects expired sessions and a wrong secret", () => {
    const token = sealSession(
      { adminId: "test-admin", expiresAt: TEST_EXPIRY },
      TEST_SECRET,
      TEST_NOW,
    );

    expect(unsealSession(token, TEST_SECRET, TEST_EXPIRY)).toBeNull();
    expect(
      unsealSession(token, "different-explicit-test-secret", TEST_NOW),
    ).toBeNull();
  });

  test("rejects malformed tokens without throwing", () => {
    expect(unsealSession("not-a-session", TEST_SECRET, TEST_NOW)).toBeNull();
    expect(unsealSession("v1.AA", TEST_SECRET, TEST_NOW)).toBeNull();
  });
});
