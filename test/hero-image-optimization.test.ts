import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { expect, test } from "vitest";
import nextConfig from "../next.config";

test("serves the LCP hero from prebuilt responsive AVIF files", async () => {
  const source = await readFile(
    new URL("../src/components/site-content/HomePageView.tsx", import.meta.url),
    "utf8",
  );

  expect(source).toContain('srcSet="/team-hero-mobile.avif"');
  expect(source).toContain('srcSet="/team-hero.avif"');
  expect(source).toContain('preload("/team-hero-mobile.avif"');
  expect(source).toContain('preload("/team-hero.avif"');
  expect(source).toContain("top-0 h-28 bg-gradient-to-b");
  expect(source).toContain("bottom-0 h-44 bg-gradient-to-t");
  await expect(access(new URL("../public/team-hero-mobile.avif", import.meta.url))).resolves.toBeUndefined();
  await expect(access(new URL("../public/team-hero.avif", import.meta.url))).resolves.toBeUndefined();
  const mobile = await sharp(
    fileURLToPath(new URL("../public/team-hero-mobile.avif", import.meta.url)),
  ).metadata();
  expect(mobile.width).toBeGreaterThanOrEqual(1440);
  expect(nextConfig.images?.formats).toEqual(["image/avif", "image/webp"]);
});
