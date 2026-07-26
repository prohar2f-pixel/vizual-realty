import { expect, test } from "vitest";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";

test("provides a safe Russian fallback snapshot for all editable site content", () => {
  expect(DEFAULT_SITE_CONTENT.schemaVersion).toBe(1);
  expect(DEFAULT_SITE_CONTENT.home.heroTitle).toContain("земельных участков");
  expect(DEFAULT_SITE_CONTENT.footer.tagline).toBe("Продажа квартир и домов.");
  expect(DEFAULT_SITE_CONTENT.footer.sectionsTitle).toBe("Разделы");
  expect(DEFAULT_SITE_CONTENT.team.members).toHaveLength(8);
  expect(new Set(DEFAULT_SITE_CONTENT.team.members.map((member) => member.id)).size).toBe(8);
  expect(JSON.stringify(DEFAULT_SITE_CONTENT)).not.toMatch(/<script|<[^>]+>/i);
});
