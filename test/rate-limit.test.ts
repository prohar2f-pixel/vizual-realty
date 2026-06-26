import { test, expect } from "vitest";
import { RateLimiter } from "../src/lib/rate-limit";

test("ждёт минимум интервал между разрешениями", async () => {
  const rl = new RateLimiter(50); // 50 мс
  const t0 = Date.now();
  await rl.wait();
  await rl.wait();
  expect(Date.now() - t0).toBeGreaterThanOrEqual(50);
});
