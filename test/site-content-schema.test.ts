import { expect, test } from "vitest";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";
import {
  parseSiteContent,
  safeParseSiteContent,
  SiteContentValidationError,
} from "../src/lib/site-content/schema";

function copyDefaultContent() {
  return structuredClone(DEFAULT_SITE_CONTENT);
}

test("accepts the shipped editable content and returns a normalized copy", () => {
  const parsed = parseSiteContent(DEFAULT_SITE_CONTENT);

  expect(parsed).toMatchObject({
    schemaVersion: 1,
    navigation: DEFAULT_SITE_CONTENT.navigation,
    team: { members: expect.any(Array) },
  });
  expect(parsed.team.members).toHaveLength(DEFAULT_SITE_CONTENT.team.members.length);
  expect(parsed).not.toBe(DEFAULT_SITE_CONTENT);
});

test("rejects unknown object keys", () => {
  const content = { ...copyDefaultContent(), extra: true };

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("rejects HTML, Markdown links, and URL schemes in editable text", () => {
  const html = copyDefaultContent();
  html.home.heroTitle = "<b>Unsafe</b>";

  const markdown = copyDefaultContent();
  markdown.home.heroTitle = "[Click](https://example.com)";

  const urlScheme = copyDefaultContent();
  urlScheme.home.heroTitle = "javascript:alert(1)";

  expect(() => parseSiteContent(html)).toThrow(SiteContentValidationError);
  expect(() => parseSiteContent(markdown)).toThrow(SiteContentValidationError);
  expect(() => parseSiteContent(urlScheme)).toThrow(SiteContentValidationError);
});

test("rejects Markdown bold syntax in editable text", () => {
  const content = copyDefaultContent();
  content.home.heroTitle = "**Важное объявление**";

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("rejects Markdown inline code syntax in editable text", () => {
  const content = copyDefaultContent();
  content.home.heroTitle = "Используйте `код`";

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("rejects Markdown heading syntax in editable text", () => {
  const content = copyDefaultContent();
  content.home.heroTitle = "# Заголовок";

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("rejects Markdown list syntax in editable text", () => {
  const content = copyDefaultContent();
  content.home.heroTitle = "- Первый пункт";

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("rejects Markdown reference links and definitions in editable text", () => {
  const content = copyDefaultContent();
  content.home.heroTitle = "[Каталог][docs]\n\n[docs]: /catalog";

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("rejects Markdown thematic breaks in editable text", () => {
  const content = copyDefaultContent();
  content.home.heroTitle = "---";

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("allows ordinary Russian punctuation in editable text", () => {
  const content = copyDefaultContent();
  content.home.heroTitle = "«Визуал»: продажа, покупка — без комиссии!";

  expect(parseSiteContent(content).home.heroTitle).toBe("«Визуал»: продажа, покупка — без комиссии!");
});

test("allows ordinary hyphens and dashes in editable text", () => {
  const content = copyDefaultContent();
  content.home.heroTitle = "Юго-восток — спокойный район";

  expect(parseSiteContent(content).home.heroTitle).toBe("Юго-восток — спокойный район");
});

test("rejects content that inherits required and unknown fields from a prototype", () => {
  const inherited = { ...copyDefaultContent(), inheritedExtra: true };
  const content = Object.create(inherited);

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("enforces the 120 character short-text and 1200 character paragraph limits", () => {
  const longLabel = copyDefaultContent();
  longLabel.home.heroHeading = "a".repeat(121);

  const longParagraph = copyDefaultContent();
  longParagraph.about.introduction[0] = "a".repeat(1201);

  expect(() => parseSiteContent(longLabel)).toThrow(SiteContentValidationError);
  expect(() => parseSiteContent(longParagraph)).toThrow(SiteContentValidationError);
});

test("limits benefits to six and team cards to thirty", () => {
  const tooManyBenefits = copyDefaultContent();
  tooManyBenefits.home.benefits = Array.from({ length: 7 }, (_, index) => ({
    title: `Benefit ${index + 1}`,
  }));

  const tooManyMembers = copyDefaultContent();
  const template = tooManyMembers.team.members[0];
  tooManyMembers.team.members = Array.from({ length: 31 }, (_, index) => ({
    ...template,
    id: `member-${index + 1}`,
    topnlabAgentId: `${1000 + index}`,
  }));

  expect(() => parseSiteContent(tooManyBenefits)).toThrow(SiteContentValidationError);
  expect(() => parseSiteContent(tooManyMembers)).toThrow(SiteContentValidationError);
});

test("requires unique card and nonempty Topnlab agent IDs", () => {
  const duplicateCardId = copyDefaultContent();
  duplicateCardId.team.members[1].id = duplicateCardId.team.members[0].id;

  const duplicateAgentId = copyDefaultContent();
  duplicateAgentId.team.members[1].topnlabAgentId =
    duplicateAgentId.team.members[0].topnlabAgentId;

  expect(() => parseSiteContent(duplicateCardId)).toThrow(SiteContentValidationError);
  expect(() => parseSiteContent(duplicateAgentId)).toThrow(SiteContentValidationError);
});

test("requires a visible team member to expose at least one contact", () => {
  const content = copyDefaultContent();
  const member = content.team.members[0];
  delete member.phone;
  delete member.email;
  delete member.telegram;

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("allows a hidden team member without contact details", () => {
  const content = copyDefaultContent();
  const member = content.team.members[0];
  member.isVisible = false;
  delete member.phone;
  delete member.email;
  delete member.telegram;

  expect(parseSiteContent(content).team.members[0]).toMatchObject({
    id: "ayanot-elena",
    isVisible: false,
  });
});

test("normalizes whitespace and contact values", () => {
  const content = copyDefaultContent();
  content.home.heroHeading = "  Недвижимость\n  в Донецке  ";
  content.team.members[0].phone = " 8 949 537 55 65 ";
  content.team.members[0].email = "  Elena@Example.COM ";
  content.team.members[0].telegram = " https://t.me/Elena_Agent ";
  content.team.members[0].topnlabAgentId = " 296892 ";

  const parsed = parseSiteContent(content);

  expect(parsed.home.heroHeading).toBe("Недвижимость в Донецке");
  expect(parsed.team.members[0]).toMatchObject({
    phone: "+79495375565",
    email: "elena@example.com",
    telegram: "Elena_Agent",
    topnlabAgentId: "296892",
  });
});

test("rejects phone values that contain non-phone characters", () => {
  const content = copyDefaultContent();
  content.team.members[0].phone = "call 8 949 537 55 65";

  expect(() => parseSiteContent(content)).toThrow(SiteContentValidationError);
});

test("returns structured issues instead of throwing from safe parsing", () => {
  const content = copyDefaultContent();
  content.team.members[0].name = "";

  const result = safeParseSiteContent(content);

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "team.members[0].name" }),
      ]),
    );
  }
});
