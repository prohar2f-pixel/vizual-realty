import { scrypt as scryptCallback } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AdminConfigurationError,
  readAdminAuthConfig,
  verifyAdminPassword,
} from "../src/lib/admin/auth";
import { AdminRequestError, assertTrustedOrigin } from "../src/lib/admin/request";
import { unsealSession, type AdminSession } from "../src/lib/admin/session";
import { createLoginHandler } from "../src/app/api/admin/login/route";
import { createLogoutHandler } from "../src/app/api/admin/logout/route";
import { LoginPageView } from "../src/app/admin/login/page";

const nextCookies = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: nextCookies }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const TEST_PASSWORD = "correct explicit test password";
const TEST_SECRET = "test-session-secret-that-is-not-used-anywhere-real";
const TEST_HASH_PLACEHOLDER = "scrypt$1024$8$1$dGVzdC1zYWx0$dGVzdC1oYXNo";
const TEST_ORIGIN = "https://admin.test.invalid";
const TEST_NOW = Date.parse("2026-07-26T08:00:00.000Z");

async function makeTestHash(password = TEST_PASSWORD) {
  const salt = Buffer.from("fixed-test-salt", "utf8");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, 32, { N: 1024, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
  return `scrypt$1024$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function testConfig(passwordHash: string) {
  return {
    username: "test-admin",
    passwordHash,
    sessionSecret: TEST_SECRET,
    siteOrigin: TEST_ORIGIN,
    sessionTtlSeconds: 12 * 60 * 60,
    secureCookie: false,
  };
}

function loginRequest(username: string, password: string, origin = TEST_ORIGIN) {
  const form = new FormData();
  form.set("username", username);
  form.set("password", password);
  return new Request(`${TEST_ORIGIN}/api/admin/login`, {
    method: "POST",
    headers: { origin },
    body: form,
  });
}

describe("admin password and configuration", () => {
  test("accepts only the correct password for the encoded scrypt hash", async () => {
    const hash = await makeTestHash();

    await expect(verifyAdminPassword(TEST_PASSWORD, hash)).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong explicit test password", hash)).resolves.toBe(false);
  });

  test("rejects malformed or unsafe scrypt hash parameters", async () => {
    await expect(verifyAdminPassword(TEST_PASSWORD, "not-scrypt")).resolves.toBe(false);
    await expect(
      verifyAdminPassword(
        TEST_PASSWORD,
        "scrypt$3$8$1$Zml4ZWQtdGVzdC1zYWx0$Zml4ZWQtdGVzdC1oYXNo",
      ),
    ).resolves.toBe(false);
  });

  test.each([
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD_HASH",
    "ADMIN_SESSION_SECRET",
    "SITE_ORIGIN",
  ])("fails safely when %s is absent", (missing) => {
    const values: Record<string, string | undefined> = {
      ADMIN_USERNAME: "test-admin",
      ADMIN_PASSWORD_HASH: TEST_HASH_PLACEHOLDER,
      ADMIN_SESSION_SECRET: TEST_SECRET,
      SITE_ORIGIN: TEST_ORIGIN,
    };
    delete values[missing];

    expect(() => readAdminAuthConfig(values)).toThrow(AdminConfigurationError);
    try {
      readAdminAuthConfig(values);
    } catch (error) {
      expect(String(error)).toBe("AdminConfigurationError: Admin authentication is not configured");
      expect(String(error)).not.toContain(TEST_SECRET);
      expect(String(error)).not.toContain(TEST_HASH_PLACEHOLDER);
    }
  });

  test("defaults the session lifetime to twelve hours", () => {
    expect(
      readAdminAuthConfig({
        ADMIN_USERNAME: "test-admin",
        ADMIN_PASSWORD_HASH: TEST_HASH_PLACEHOLDER,
        ADMIN_SESSION_SECRET: TEST_SECRET,
        SITE_ORIGIN: TEST_ORIGIN,
      }).sessionTtlSeconds,
    ).toBe(43_200);
  });
});

describe("trusted request origin", () => {
  test("accepts only an exact Origin match", () => {
    expect(() =>
      assertTrustedOrigin(
        new Request(`${TEST_ORIGIN}/api/admin/logout`, {
          method: "POST",
          headers: { origin: TEST_ORIGIN },
        }),
        TEST_ORIGIN,
      ),
    ).not.toThrow();

    for (const origin of ["", `${TEST_ORIGIN}/`, "https://evil.test.invalid"]) {
      const request = new Request(`${TEST_ORIGIN}/api/admin/logout`, {
        method: "POST",
        headers: origin ? { origin } : undefined,
      });
      expect(() => assertTrustedOrigin(request, TEST_ORIGIN)).toThrow(AdminRequestError);
      try {
        assertTrustedOrigin(request, TEST_ORIGIN);
      } catch (error) {
        expect((error as AdminRequestError).status).toBe(403);
        if (origin) expect(String(error)).not.toContain(origin);
        expect(String(error)).not.toContain(TEST_ORIGIN);
      }
    }
  });
});

test("does not swallow errors from the Next cookies request boundary", async () => {
  vi.stubEnv("ADMIN_USERNAME", "test-admin");
  vi.stubEnv("ADMIN_PASSWORD_HASH", TEST_HASH_PLACEHOLDER);
  vi.stubEnv("ADMIN_SESSION_SECRET", TEST_SECRET);
  vi.stubEnv("SITE_ORIGIN", TEST_ORIGIN);
  nextCookies.mockRejectedValueOnce(new Error("test request boundary error"));

  try {
    const { getAdminSession } = await import("../src/lib/admin/request");
    await expect(getAdminSession()).rejects.toThrow("test request boundary error");
  } finally {
    vi.unstubAllEnvs();
  }
});

describe("admin login and logout routes", () => {
  beforeEach(() => vi.restoreAllMocks());

  test("sets a protected encrypted cookie after valid credentials", async () => {
    const hash = await makeTestHash();
    const set = vi.fn();
    const handler = createLoginHandler({
      readConfig: () => testConfig(hash),
      getCookieStore: async () => ({ set }),
      consumeAttempt: () => ({ allowed: true, retryAfterSeconds: 0 }),
      now: () => TEST_NOW,
    });

    const response = await handler(loginRequest("test-admin", TEST_PASSWORD));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(set).toHaveBeenCalledOnce();
    const cookie = set.mock.calls[0][0];
    expect(cookie).toMatchObject({
      name: "vizual_admin_session",
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: 43_200,
      expires: new Date(TEST_NOW + 43_200_000),
    });
    expect(unsealSession(cookie.value, TEST_SECRET, TEST_NOW)).toMatchObject({
      adminId: "test-admin",
      issuedAt: TEST_NOW,
      expiresAt: TEST_NOW + 43_200_000,
    });
  });

  test.each([
    ["wrong-admin", TEST_PASSWORD],
    ["test-admin", "wrong explicit test password"],
  ])("uses one safe error for invalid credentials", async (username, password) => {
    const hash = await makeTestHash();
    const set = vi.fn();
    const handler = createLoginHandler({
      readConfig: () => testConfig(hash),
      getCookieStore: async () => ({ set }),
      consumeAttempt: () => ({ allowed: true, retryAfterSeconds: 0 }),
      now: () => TEST_NOW,
    });

    const response = await handler(loginRequest(username, password));
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(JSON.parse(body)).toEqual({ ok: false, error: "Неверный логин или пароль" });
    expect(set).not.toHaveBeenCalled();
    expect(body).not.toContain(TEST_SECRET);
    expect(body).not.toContain(hash);
    expect(body).not.toContain(password);
  });

  test("returns 429 before password work after the rate limit is exhausted", async () => {
    const verifyPassword = vi.fn();
    const handler = createLoginHandler({
      readConfig: () => testConfig(TEST_HASH_PLACEHOLDER),
      getCookieStore: async () => ({ set: vi.fn() }),
      consumeAttempt: () => ({ allowed: false, retryAfterSeconds: 120 }),
      verifyPassword,
      now: () => TEST_NOW,
    });

    const response = await handler(loginRequest("test-admin", TEST_PASSWORD));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  test("keys rate limiting by the proxy-provided real IP, not a spoofable forwarded prefix", async () => {
    const keys: string[] = [];
    const handler = createLoginHandler({
      readConfig: () => testConfig(TEST_HASH_PLACEHOLDER),
      getCookieStore: async () => ({ set: vi.fn() }),
      consumeAttempt: (key) => {
        keys.push(key);
        return { allowed: true, retryAfterSeconds: 0 };
      },
      verifyPassword: async () => false,
      now: () => TEST_NOW,
    });

    for (const spoofed of ["198.51.100.1", "198.51.100.2"]) {
      const form = new FormData();
      form.set("username", "test-admin");
      form.set("password", TEST_PASSWORD);
      await handler(
        new Request(`${TEST_ORIGIN}/api/admin/login`, {
          method: "POST",
          headers: {
            origin: TEST_ORIGIN,
            "x-forwarded-for": `${spoofed}, 203.0.113.10`,
            "x-real-ip": "203.0.113.10",
          },
          body: form,
        }),
      );
    }

    expect(keys).toEqual(["203.0.113.10", "203.0.113.10"]);
  });

  test("rejects login and logout from an untrusted origin", async () => {
    const login = createLoginHandler({
      readConfig: () => testConfig(TEST_HASH_PLACEHOLDER),
      getCookieStore: async () => ({ set: vi.fn() }),
      consumeAttempt: () => ({ allowed: true, retryAfterSeconds: 0 }),
      now: () => TEST_NOW,
    });
    const logout = createLogoutHandler({
      readConfig: () => testConfig(TEST_HASH_PLACEHOLDER),
      readSession: async () => null,
      getCookieStore: async () => ({ delete: vi.fn() }),
    });

    const loginResponse = await login(
      loginRequest("test-admin", TEST_PASSWORD, "https://evil.test.invalid"),
    );
    const logoutResponse = await logout(
      new Request(`${TEST_ORIGIN}/api/admin/logout`, {
        method: "POST",
        headers: { origin: "https://evil.test.invalid" },
      }),
    );

    expect(loginResponse.status).toBe(403);
    expect(logoutResponse.status).toBe(403);
  });

  test("requires a session for logout and deletes the cookie for a valid session", async () => {
    const deleteCookie = vi.fn();
    const noSession = createLogoutHandler({
      readConfig: () => testConfig(TEST_HASH_PLACEHOLDER),
      readSession: async () => null,
      getCookieStore: async () => ({ delete: deleteCookie }),
    });
    const request = new Request(`${TEST_ORIGIN}/api/admin/logout`, {
      method: "POST",
      headers: { origin: TEST_ORIGIN },
    });

    expect((await noSession(request)).status).toBe(401);
    expect(deleteCookie).not.toHaveBeenCalled();

    const session: AdminSession = {
      adminId: "test-admin",
      issuedAt: TEST_NOW,
      expiresAt: TEST_NOW + 60_000,
      nonce: "test-session-nonce",
    };
    const withSession = createLogoutHandler({
      readConfig: () => testConfig(TEST_HASH_PLACEHOLDER),
      readSession: async () => session,
      getCookieStore: async () => ({ delete: deleteCookie }),
    });
    const response = await withSession(request);

    expect(response.status).toBe(200);
    expect(deleteCookie).toHaveBeenCalledWith("vizual_admin_session");
  });
});

test("serialized login HTML contains no credentials or server secrets", () => {
  const html = renderToStaticMarkup(createElement(LoginPageView));

  expect(html).toContain('type="password"');
  expect(html).not.toContain(TEST_PASSWORD);
  expect(html).not.toContain(TEST_SECRET);
  expect(html).not.toContain(TEST_HASH_PLACEHOLDER);
});
