import { cookies } from "next/headers";
import { isIP } from "node:net";
import {
  readAdminAuthConfig,
  verifyAdminPassword,
  type AdminAuthConfig,
} from "../../../../lib/admin/auth";
import { AdminRequestError, assertTrustedOrigin } from "../../../../lib/admin/request";
import { ADMIN_SESSION_COOKIE, sealSession } from "../../../../lib/admin/session";
import {
  FixedWindowRateLimiter,
  type RateLimitDecision,
} from "../../../../lib/rate-limit";

const INVALID_CREDENTIALS = "Неверный логин или пароль";
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1_000;
let sourceLoginLimiter = new FixedWindowRateLimiter(5, LOGIN_RATE_WINDOW_MS);
let globalLoginLimiter = new FixedWindowRateLimiter(50, LOGIN_RATE_WINDOW_MS);

function consumeLoginAttempt(key: string, now: number): RateLimitDecision {
  const source = sourceLoginLimiter.consume(key, now);
  const global = globalLoginLimiter.consume("global", now);
  if (source.allowed && global.allowed) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      source.allowed ? 0 : source.retryAfterSeconds,
      global.allowed ? 0 : global.retryAfterSeconds,
    ),
  };
}

export function resetLoginRateLimitsForTests() {
  sourceLoginLimiter = new FixedWindowRateLimiter(5, LOGIN_RATE_WINDOW_MS);
  globalLoginLimiter = new FixedWindowRateLimiter(50, LOGIN_RATE_WINDOW_MS);
}

type Cookie = {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: "strict";
  secure: boolean;
  path: string;
  maxAge: number;
  expires: Date;
};

type LoginDependencies = {
  readConfig: () => AdminAuthConfig;
  getCookieStore: () => Promise<{ set(cookie: Cookie): void }>;
  consumeAttempt: (key: string, now: number) => RateLimitDecision;
  verifyPassword: typeof verifyAdminPassword;
  now: () => number;
};

const defaultDependencies: LoginDependencies = {
  readConfig: readAdminAuthConfig,
  getCookieStore: cookies,
  consumeAttempt: consumeLoginAttempt,
  verifyPassword: verifyAdminPassword,
  now: Date.now,
};

function json(body: unknown, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function clientKey(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && isIP(realIp)) return realIp;

  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .at(-1)
    ?.trim();
  return forwarded && isIP(forwarded) ? forwarded : "unknown";
}

export function createLoginHandler(
  overrides: Partial<LoginDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function POST(request: Request): Promise<Response> {
    try {
      const config = dependencies.readConfig();
      assertTrustedOrigin(request, config.siteOrigin);
      const now = dependencies.now();
      const decision = dependencies.consumeAttempt(clientKey(request), now);
      if (!decision.allowed) {
        return json(
          { ok: false, error: "Слишком много попыток. Попробуйте позже" },
          429,
          { "Retry-After": String(decision.retryAfterSeconds) },
        );
      }

      let username = "";
      let password = "";
      try {
        const form = await request.formData();
        const rawUsername = form.get("username");
        const rawPassword = form.get("password");
        if (typeof rawUsername === "string" && rawUsername.length <= 256) {
          username = rawUsername;
        }
        if (typeof rawPassword === "string" && rawPassword.length <= 4_096) {
          password = rawPassword;
        }
      } catch {
        return json({ ok: false, error: INVALID_CREDENTIALS }, 401);
      }

      const passwordMatches = await dependencies.verifyPassword(
        password,
        config.passwordHash,
      );
      if (!passwordMatches || username !== config.username) {
        return json({ ok: false, error: INVALID_CREDENTIALS }, 401);
      }

      const expiresAt = now + config.sessionTtlSeconds * 1_000;
      const value = sealSession(
        { adminId: config.username, expiresAt },
        config.sessionSecret,
        now,
      );
      (await dependencies.getCookieStore()).set({
        name: ADMIN_SESSION_COOKIE,
        value,
        httpOnly: true,
        sameSite: "strict",
        secure: config.secureCookie,
        path: "/",
        maxAge: config.sessionTtlSeconds,
        expires: new Date(expiresAt),
      });
      return json({ ok: true }, 200);
    } catch (error) {
      if (error instanceof AdminRequestError) {
        return json({ ok: false, error: "Запрос отклонён" }, error.status);
      }
      return json(
        { ok: false, error: "Сервис входа временно недоступен" },
        500,
      );
    }
  };
}

export const POST = createLoginHandler();
