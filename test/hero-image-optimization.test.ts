import { access, readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import nextConfig from "../next.config";

test("serves the LCP hero from prebuilt responsive AVIF files", async () => {
  const source = await readFile(
    new URL("../src/components/site-content/HomePageView.tsx", import.meta.url),
    "utf8",
  );

  expect(source).toContain('srcSet="/team-hero-mobile.avif"');
  expect(source).toContain('srcSet="/team-hero.avif"');
  await expect(access(new URL("../public/team-hero-mobile.avif", import.meta.url))).resolves.toBeUndefined();
  await expect(access(new URL("../public/team-hero.avif", import.meta.url))).resolves.toBeUndefined();
  expect(nextConfig.images?.formats).toEqual(["image/avif", "image/webp"]);
});
