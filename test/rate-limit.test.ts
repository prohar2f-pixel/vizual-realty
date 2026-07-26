import { test, expect } from "vitest";
import { FixedWindowRateLimiter, RateLimiter } from "../src/lib/rate-limit";

test("ждёт минимум интервал между разрешениями", async () => {
  const rl = new RateLimiter(50); // 50 мс
  const t0 = Date.now();
  await rl.wait();
  await rl.wait();
  expect(Date.now() - t0).toBeGreaterThanOrEqual(50);
});

test("блокирует попытки сверх лимита до окончания фиксированного окна", () => {
  const limiter = new FixedWindowRateLimiter(2, 60_000);

  expect(limiter.consume("test-client", 1_000)).toEqual({
    allowed: true,
    retryAfterSeconds: 0,
  });
  expect(limiter.consume("test-client", 2_000)).toEqual({
    allowed: true,
    retryAfterSeconds: 0,
  });
  expect(limiter.consume("test-client", 3_000)).toEqual({
    allowed: false,
    retryAfterSeconds: 58,
  });
  expect(limiter.consume("test-client", 61_000)).toEqual({
    allowed: true,
    retryAfterSeconds: 0,
  });
});

test("считает попытки независимо для разных клиентов", () => {
  const limiter = new FixedWindowRateLimiter(1, 60_000);

  expect(limiter.consume("first", 1_000).allowed).toBe(true);
  expect(limiter.consume("first", 2_000).allowed).toBe(false);
  expect(limiter.consume("second", 2_000).allowed).toBe(true);
});
