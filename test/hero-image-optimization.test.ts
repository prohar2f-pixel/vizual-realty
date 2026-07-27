import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import nextConfig from "../next.config";

test("serves the LCP hero image through Next image optimization", async () => {
  const source = await readFile(
    new URL("../src/components/site-content/HomePageView.tsx", import.meta.url),
    "utf8",
  );

  expect(source).toContain('src="/team-hero.jpeg"');
  expect(source).not.toMatch(/src="\/team-hero\.jpeg"[\s\S]*?unoptimized/);
  expect(nextConfig.images?.formats).toEqual(["image/avif", "image/webp"]);
});
