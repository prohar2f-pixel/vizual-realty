export type TeamMemberV1 = {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  telegram?: string;
  imageId?: string;
  topnlabAgentId?: string;
  isVisible: boolean;
};

export type SiteContentV1 = {
  schemaVersion: 1;
  navigation: {
    home: string;
    catalog: string;
    about: string;
    team: string;
    contacts: string;
  };
  footer: {
    tagline: string;
    sectionsTitle: string;
    catalogLabel: string;
    contactsTitle: string;
    address: string;
    phone: string;
    email: string;
    copyright: string;
  };
  home: {
    heroHeading: string;
    heroTitle: string;
    heroSubtitle: string;
    catalogCta: string;
    contactsCta: string;
    featuredTitle: string;
    featuredCatalogLabel: string;
    featuredEmptyText: string;
    whyTitle: string;
    whyIntroduction: string;
    benefits: Array<{ title: string; description?: string }>;
    aboutCta: string;
    statisticLabel: string;
    statisticValue: string;
    statisticDescription: string;
  };
  about: {
    title: string;
    introduction: string[];
    servicesTitle: string;
    services: string[];
    closingText: string;
    teamCta: string;
    teamCtaText: string;
  };
  team: {
    title: string;
    introduction: string;
    members: TeamMemberV1[];
  };
  contacts: {
    title: string;
    managersTitle: string;
    phoneLabel: string;
    emailLabel: string;
    addressLabel: string;
    address: string;
    phone: string;
    email: string;
    routeCta: string;
  };
};

export type ContentIssue = {
  path: string;
  message: string;
};

export class SiteContentValidationError extends Error {
  constructor(readonly issues: ContentIssue[]) {
    super(`Invalid site content: ${issues.map((issue) => issue.path).join(", ")}`);
    this.name = "SiteContentValidationError";
  }
}

type UnknownRecord = Record<string, unknown>;

const SHORT_TEXT_LIMIT = 120;
const PARAGRAPH_LIMIT = 1200;
const MAX_BENEFITS = 6;
const MAX_TEAM_MEMBERS = 30;
const MAX_INTRODUCTION_PARAGRAPHS = 12;
const MAX_SERVICES = 12;
const FORBIDDEN_TEXT = /[<>]|\[[^\]]*\]\([^)]*\)|\b[a-z][a-z0-9+.-]*:/i;
const INLINE_MARKDOWN = /(?:\*\*|__|~~|`)|(?:^|\s)(?:\*[^*\n]+\*|_[^_\n]+_)/;
const BLOCK_MARKDOWN = /^\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s)/m;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEGRAM_USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addIssue(issues: ContentIssue[], path: string, message: string) {
  issues.push({ path, message });
}

function exactObject(
  value: unknown,
  path: string,
  keys: readonly string[],
  issues: ContentIssue[],
  optionalKeys: readonly string[] = [],
): UnknownRecord | undefined {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an object");
    return undefined;
  }

  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      addIssue(issues, `${path}.${key}`, "is not allowed");
    }
  }

  for (const key of keys) {
    if (!Object.hasOwn(value, key) && !optionalKeys.includes(key)) {
      addIssue(issues, `${path}.${key}`, "is required");
    }
  }

  return value;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function containsForbiddenText(value: string, normalized: string) {
  return FORBIDDEN_TEXT.test(normalized) || INLINE_MARKDOWN.test(normalized) || BLOCK_MARKDOWN.test(value);
}

function text(
  value: unknown,
  path: string,
  limit: number,
  issues: ContentIssue[],
): string {
  if (typeof value !== "string") {
    addIssue(issues, path, "must be a string");
    return "";
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) addIssue(issues, path, "must not be empty");
  if (normalized.length > limit) addIssue(issues, path, `must be at most ${limit} characters`);
  if (containsForbiddenText(value, normalized)) addIssue(issues, path, "must not contain markup or a URL scheme");
  return normalized;
}

function optionalText(value: unknown, path: string, limit: number, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "must be a string");
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;
  if (normalized.length > limit) addIssue(issues, path, `must be at most ${limit} characters`);
  if (containsForbiddenText(value, normalized)) addIssue(issues, path, "must not contain markup or a URL scheme");
  return normalized;
}

function optionalPhone(value: unknown, path: string, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "must be a string");
    return undefined;
  }

  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return undefined;
  if (!/^[\d\s()+.-]+$/.test(trimmed)) addIssue(issues, path, "must contain only phone characters");
  const digits = trimmed.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("8") ? `+7${digits.slice(1)}` : `+${digits}`;
  if (!/^\+\d{11,15}$/.test(normalized)) addIssue(issues, path, "must be a valid phone number");
  return normalized;
}

function optionalEmail(value: unknown, path: string, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "must be a string");
    return undefined;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return undefined;
  if (!EMAIL.test(normalized)) addIssue(issues, path, "must be a valid email address");
  return normalized;
}

function optionalTelegram(value: unknown, path: string, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "must be a string");
    return undefined;
  }

  const input = normalizeWhitespace(value);
  if (!input) return undefined;
  const normalized = input.replace(/^https:\/\/t\.me\//i, "").replace(/^@/, "");
  if (!TELEGRAM_USERNAME.test(normalized)) addIssue(issues, path, "must be a Telegram username or https://t.me URL");
  return normalized;
}

function optionalAgentId(value: unknown, path: string, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "must be a string");
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;
  if (!/^\d+$/.test(normalized)) addIssue(issues, path, "must contain digits only");
  return normalized;
}

function shortId(value: unknown, path: string, issues: ContentIssue[]) {
  const normalized = text(value, path, SHORT_TEXT_LIMIT, issues);
  if (normalized && !SAFE_ID.test(normalized)) addIssue(issues, path, "must be a lowercase hyphenated identifier");
  return normalized;
}

function requiredPhone(value: unknown, path: string, issues: ContentIssue[]) {
  const normalized = optionalPhone(value, path, issues);
  if (!normalized) addIssue(issues, path, "is required");
  return normalized ?? "";
}

function requiredEmail(value: unknown, path: string, issues: ContentIssue[]) {
  const normalized = optionalEmail(value, path, issues);
  if (!normalized) addIssue(issues, path, "is required");
  return normalized ?? "";
}

function stringArray(
  value: unknown,
  path: string,
  maxLength: number,
  issues: ContentIssue[],
): string[] {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "must be an array");
    return [];
  }
  if (value.length > maxLength) addIssue(issues, path, `must contain at most ${maxLength} items`);
  return value.map((item, index) => text(item, `${path}[${index}]`, PARAGRAPH_LIMIT, issues));
}

function parseBenefits(value: unknown, issues: ContentIssue[]) {
  if (!Array.isArray(value)) {
    addIssue(issues, "home.benefits", "must be an array");
    return [];
  }
  if (value.length > MAX_BENEFITS) addIssue(issues, "home.benefits", "must contain at most 6 items");

  return value.map((benefit, index) => {
    const path = `home.benefits[${index}]`;
    const record = exactObject(benefit, path, ["title", "description"], issues, ["description"]);
    return {
      title: text(record?.title, `${path}.title`, SHORT_TEXT_LIMIT, issues),
      ...(record?.description === undefined
        ? {}
        : { description: optionalText(record.description, `${path}.description`, SHORT_TEXT_LIMIT, issues) }),
    };
  });
}

function parseMember(value: unknown, index: number, issues: ContentIssue[]): TeamMemberV1 {
  const path = `team.members[${index}]`;
  const record = exactObject(
    value,
    path,
    ["id", "name", "role", "phone", "email", "telegram", "imageId", "topnlabAgentId", "isVisible"],
    issues,
    ["role", "phone", "email", "telegram", "imageId", "topnlabAgentId"],
  );
  const phone = optionalPhone(record?.phone, `${path}.phone`, issues);
  const email = optionalEmail(record?.email, `${path}.email`, issues);
  const telegram = optionalTelegram(record?.telegram, `${path}.telegram`, issues);
  const isVisible = record?.isVisible;
  if (typeof isVisible !== "boolean") addIssue(issues, `${path}.isVisible`, "must be a boolean");
  if (isVisible === true && !phone && !email && !telegram) {
    addIssue(issues, path, "visible members must provide a phone, email, or Telegram contact");
  }

  return {
    id: shortId(record?.id, `${path}.id`, issues),
    name: text(record?.name, `${path}.name`, SHORT_TEXT_LIMIT, issues),
    ...(record?.role === undefined ? {} : { role: optionalText(record.role, `${path}.role`, SHORT_TEXT_LIMIT, issues) }),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(telegram ? { telegram } : {}),
    ...(record?.imageId === undefined ? {} : { imageId: shortId(record.imageId, `${path}.imageId`, issues) }),
    ...(record?.topnlabAgentId === undefined
      ? {}
      : { topnlabAgentId: optionalAgentId(record.topnlabAgentId, `${path}.topnlabAgentId`, issues) }),
    isVisible: isVisible === true,
  };
}

function parseMembers(value: unknown, issues: ContentIssue[]) {
  if (!Array.isArray(value)) {
    addIssue(issues, "team.members", "must be an array");
    return [];
  }
  if (value.length > MAX_TEAM_MEMBERS) addIssue(issues, "team.members", "must contain at most 30 items");

  const members = value.map((member, index) => parseMember(member, index, issues));
  const cardIds = new Set<string>();
  const agentIds = new Set<string>();
  for (const [index, member] of members.entries()) {
    if (member.id && cardIds.has(member.id)) addIssue(issues, `team.members[${index}].id`, "must be unique");
    cardIds.add(member.id);
    if (member.topnlabAgentId) {
      if (agentIds.has(member.topnlabAgentId)) {
        addIssue(issues, `team.members[${index}].topnlabAgentId`, "must be unique when present");
      }
      agentIds.add(member.topnlabAgentId);
    }
  }
  return members;
}

export function safeParseSiteContent(
  value: unknown,
): { success: true; data: SiteContentV1 } | { success: false; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  const root = exactObject(value, "content", ["schemaVersion", "navigation", "footer", "home", "about", "team", "contacts"], issues);
  if (!root) return { success: false, issues };

  if (root.schemaVersion !== 1) addIssue(issues, "schemaVersion", "must equal 1");

  const navigation = exactObject(root.navigation, "navigation", ["home", "catalog", "about", "team", "contacts"], issues);
  const footer = exactObject(
    root.footer,
    "footer",
    ["tagline", "sectionsTitle", "catalogLabel", "contactsTitle", "address", "phone", "email", "copyright"],
    issues,
  );
  const home = exactObject(
    root.home,
    "home",
    [
      "heroHeading",
      "heroTitle",
      "heroSubtitle",
      "catalogCta",
      "contactsCta",
      "featuredTitle",
      "featuredCatalogLabel",
      "featuredEmptyText",
      "whyTitle",
      "whyIntroduction",
      "benefits",
      "aboutCta",
      "statisticLabel",
      "statisticValue",
      "statisticDescription",
    ],
    issues,
  );
  const about = exactObject(
    root.about,
    "about",
    ["title", "introduction", "servicesTitle", "services", "closingText", "teamCta", "teamCtaText"],
    issues,
  );
  const team = exactObject(root.team, "team", ["title", "introduction", "members"], issues);
  const contacts = exactObject(
    root.contacts,
    "contacts",
    ["title", "managersTitle", "phoneLabel", "emailLabel", "addressLabel", "address", "phone", "email", "routeCta"],
    issues,
  );

  const data: SiteContentV1 = {
    schemaVersion: 1,
    navigation: {
      home: text(navigation?.home, "navigation.home", SHORT_TEXT_LIMIT, issues),
      catalog: text(navigation?.catalog, "navigation.catalog", SHORT_TEXT_LIMIT, issues),
      about: text(navigation?.about, "navigation.about", SHORT_TEXT_LIMIT, issues),
      team: text(navigation?.team, "navigation.team", SHORT_TEXT_LIMIT, issues),
      contacts: text(navigation?.contacts, "navigation.contacts", SHORT_TEXT_LIMIT, issues),
    },
    footer: {
      tagline: text(footer?.tagline, "footer.tagline", SHORT_TEXT_LIMIT, issues),
      sectionsTitle: text(footer?.sectionsTitle, "footer.sectionsTitle", SHORT_TEXT_LIMIT, issues),
      catalogLabel: text(footer?.catalogLabel, "footer.catalogLabel", SHORT_TEXT_LIMIT, issues),
      contactsTitle: text(footer?.contactsTitle, "footer.contactsTitle", SHORT_TEXT_LIMIT, issues),
      address: text(footer?.address, "footer.address", SHORT_TEXT_LIMIT, issues),
      phone: requiredPhone(footer?.phone, "footer.phone", issues),
      email: requiredEmail(footer?.email, "footer.email", issues),
      copyright: text(footer?.copyright, "footer.copyright", SHORT_TEXT_LIMIT, issues),
    },
    home: {
      heroHeading: text(home?.heroHeading, "home.heroHeading", SHORT_TEXT_LIMIT, issues),
      heroTitle: text(home?.heroTitle, "home.heroTitle", SHORT_TEXT_LIMIT, issues),
      heroSubtitle: text(home?.heroSubtitle, "home.heroSubtitle", PARAGRAPH_LIMIT, issues),
      catalogCta: text(home?.catalogCta, "home.catalogCta", SHORT_TEXT_LIMIT, issues),
      contactsCta: text(home?.contactsCta, "home.contactsCta", SHORT_TEXT_LIMIT, issues),
      featuredTitle: text(home?.featuredTitle, "home.featuredTitle", SHORT_TEXT_LIMIT, issues),
      featuredCatalogLabel: text(home?.featuredCatalogLabel, "home.featuredCatalogLabel", SHORT_TEXT_LIMIT, issues),
      featuredEmptyText: text(home?.featuredEmptyText, "home.featuredEmptyText", SHORT_TEXT_LIMIT, issues),
      whyTitle: text(home?.whyTitle, "home.whyTitle", SHORT_TEXT_LIMIT, issues),
      whyIntroduction: text(home?.whyIntroduction, "home.whyIntroduction", PARAGRAPH_LIMIT, issues),
      benefits: parseBenefits(home?.benefits, issues),
      aboutCta: text(home?.aboutCta, "home.aboutCta", SHORT_TEXT_LIMIT, issues),
      statisticLabel: text(home?.statisticLabel, "home.statisticLabel", SHORT_TEXT_LIMIT, issues),
      statisticValue: text(home?.statisticValue, "home.statisticValue", SHORT_TEXT_LIMIT, issues),
      statisticDescription: text(home?.statisticDescription, "home.statisticDescription", SHORT_TEXT_LIMIT, issues),
    },
    about: {
      title: text(about?.title, "about.title", SHORT_TEXT_LIMIT, issues),
      introduction: stringArray(about?.introduction, "about.introduction", MAX_INTRODUCTION_PARAGRAPHS, issues),
      servicesTitle: text(about?.servicesTitle, "about.servicesTitle", SHORT_TEXT_LIMIT, issues),
      services: stringArray(about?.services, "about.services", MAX_SERVICES, issues),
      closingText: text(about?.closingText, "about.closingText", PARAGRAPH_LIMIT, issues),
      teamCta: text(about?.teamCta, "about.teamCta", SHORT_TEXT_LIMIT, issues),
      teamCtaText: text(about?.teamCtaText, "about.teamCtaText", PARAGRAPH_LIMIT, issues),
    },
    team: {
      title: text(team?.title, "team.title", SHORT_TEXT_LIMIT, issues),
      introduction: text(team?.introduction, "team.introduction", PARAGRAPH_LIMIT, issues),
      members: parseMembers(team?.members, issues),
    },
    contacts: {
      title: text(contacts?.title, "contacts.title", SHORT_TEXT_LIMIT, issues),
      managersTitle: text(contacts?.managersTitle, "contacts.managersTitle", SHORT_TEXT_LIMIT, issues),
      phoneLabel: text(contacts?.phoneLabel, "contacts.phoneLabel", SHORT_TEXT_LIMIT, issues),
      emailLabel: text(contacts?.emailLabel, "contacts.emailLabel", SHORT_TEXT_LIMIT, issues),
      addressLabel: text(contacts?.addressLabel, "contacts.addressLabel", SHORT_TEXT_LIMIT, issues),
      address: text(contacts?.address, "contacts.address", SHORT_TEXT_LIMIT, issues),
      phone: requiredPhone(contacts?.phone, "contacts.phone", issues),
      email: requiredEmail(contacts?.email, "contacts.email", issues),
      routeCta: text(contacts?.routeCta, "contacts.routeCta", SHORT_TEXT_LIMIT, issues),
    },
  };

  return issues.length ? { success: false, issues } : { success: true, data };
}

export function parseSiteContent(value: unknown): SiteContentV1 {
  const result = safeParseSiteContent(value);
  if (!result.success) throw new SiteContentValidationError(result.issues);
  return result.data;
}
