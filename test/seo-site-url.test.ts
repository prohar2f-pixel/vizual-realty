import { afterEach, expect, test, vi } from "vitest";

const originalSiteUrl = process.env.SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.SITE_URL;
  } else {
    process.env.SITE_URL = originalSiteUrl;
  }
  vi.resetModules();
});

test("uses the production domain when SITE_URL is not configured", async () => {
  delete process.env.SITE_URL;
  const { getSiteUrl } = await import("../src/lib/site-url");

  expect(getSiteUrl()).toBe("https://nedvizhimostdoneck.ru");
});

test("uses SITE_URL when it is configured", async () => {
  process.env.SITE_URL = "https://staging.example.test/";
  const { getSiteUrl } = await import("../src/lib/site-url");

  expect(getSiteUrl()).toBe("https://staging.example.test");
});
