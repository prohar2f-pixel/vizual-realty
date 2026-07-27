export type TeamMemberV1 = {
  id: string;
  name: string;
  role?: string;
  description?: string;
  phone?: string;
  email?: string;
  telegram?: string;
  imageId?: string;
  topnlabAgentId?: string;
  isVisible: boolean;
};

export type AboutStatisticV1 = {
  value: string;
  label: string;
};

export type LeadFormContentV1 = {
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  contactLabel: string;
  contactPlaceholder: string;
  messageLabel: string;
  submitLabel: string;
  submittingLabel: string;
  successTitle: string;
  successHelper: string;
  errorText: string;
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
    statistics: AboutStatisticV1[];
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
    introduction: string;
    managersTitle: string;
    phoneLabel: string;
    emailLabel: string;
    addressLabel: string;
    address: string;
    phone: string;
    email: string;
    businessHoursLabel: string;
    businessHours: string;
    routeCta: string;
    form: LeadFormContentV1;
  };
};

export type ContentIssue = {
  path: string;
  message: string;
};

export class SiteContentValidationError extends Error {
  constructor(readonly issues: ContentIssue[]) {
    super(`Некорректное содержимое сайта: ${issues.map((issue) => issue.path).join(", ")}`);
    this.name = "SiteContentValidationError";
  }
}

type UnknownRecord = Record<string, unknown>;

const SHORT_TEXT_LIMIT = 120;
const PARAGRAPH_LIMIT = 1200;
const MAX_BENEFITS = 6;
const MAX_ABOUT_STATISTICS = 6;
const MAX_TEAM_MEMBERS = 30;
const MAX_INTRODUCTION_PARAGRAPHS = 12;
const MAX_SERVICES = 12;
const FORBIDDEN_TEXT = /[<>]|\[[^\]]*\]\([^)]*\)|\b[a-z][a-z0-9+.-]*:/i;
const MARKDOWN_META_CHARACTERS = /[*_`\[\]#~|]/;
const BLOCK_MARKDOWN = /^\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|(?:[-=*_]\s*){3,}|\[[^\]\n]+\]:\s*\S+|(?: {4}|\t)\S)/m;
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
    addIssue(issues, path, "Значение должно быть объектом.");
    return undefined;
  }

  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      addIssue(issues, `${path}.${key}`, "Поле не разрешено.");
    }
  }

  for (const key of keys) {
    if (!Object.hasOwn(value, key) && !optionalKeys.includes(key)) {
      addIssue(issues, `${path}.${key}`, "Обязательное поле.");
    }
  }

  return value;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function containsForbiddenText(value: string, normalized: string) {
  return FORBIDDEN_TEXT.test(normalized) || MARKDOWN_META_CHARACTERS.test(normalized) || BLOCK_MARKDOWN.test(value);
}

function text(
  value: unknown,
  path: string,
  limit: number,
  issues: ContentIssue[],
): string {
  if (typeof value !== "string") {
    addIssue(issues, path, "Значение должно быть текстом.");
    return "";
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) addIssue(issues, path, "Поле не должно быть пустым.");
  if (normalized.length > limit) addIssue(issues, path, `Не более ${limit} символов.`);
  if (containsForbiddenText(value, normalized)) addIssue(issues, path, "HTML, Markdown и ссылки с протоколом запрещены.");
  return normalized;
}

function optionalText(value: unknown, path: string, limit: number, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "Значение должно быть текстом.");
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;
  if (normalized.length > limit) addIssue(issues, path, `Не более ${limit} символов.`);
  if (containsForbiddenText(value, normalized)) addIssue(issues, path, "HTML, Markdown и ссылки с протоколом запрещены.");
  return normalized;
}

function displayText(
  value: unknown,
  path: string,
  limit: number,
  issues: ContentIssue[],
): string {
  if (typeof value !== "string") {
    addIssue(issues, path, "Значение должно быть текстом.");
    return "";
  }
  const normalized = normalizeWhitespace(value);
  if (normalized.length > limit) addIssue(issues, path, `Не более ${limit} символов.`);
  if (normalized && containsForbiddenText(value, normalized)) {
    addIssue(issues, path, "HTML, Markdown и ссылки с протоколом запрещены.");
  }
  return normalized;
}

function optionalPhone(value: unknown, path: string, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "Значение должно быть текстом.");
    return undefined;
  }

  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return undefined;
  if (!/^[\d\s()+.-]+$/.test(trimmed)) addIssue(issues, path, "Используйте только цифры и допустимые символы телефона.");
  const digits = trimmed.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("8") ? `+7${digits.slice(1)}` : `+${digits}`;
  if (!/^\+\d{11,15}$/.test(normalized)) addIssue(issues, path, "Укажите корректный номер телефона.");
  return normalized;
}

function optionalEmail(value: unknown, path: string, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "Значение должно быть текстом.");
    return undefined;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return undefined;
  if (!EMAIL.test(normalized)) addIssue(issues, path, "Укажите корректный E-mail.");
  return normalized;
}

function optionalTelegram(value: unknown, path: string, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "Значение должно быть текстом.");
    return undefined;
  }

  const input = normalizeWhitespace(value);
  if (!input) return undefined;
  const normalized = input.replace(/^https:\/\/t\.me\//i, "").replace(/^@/, "");
  if (!TELEGRAM_USERNAME.test(normalized)) addIssue(issues, path, "Укажите имя пользователя Telegram или ссылку t.me.");
  return normalized;
}

function optionalAgentId(value: unknown, path: string, issues: ContentIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, path, "Значение должно быть текстом.");
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;
  if (!/^\d+$/.test(normalized)) addIssue(issues, path, "Допустимы только цифры.");
  return normalized;
}

function shortId(value: unknown, path: string, issues: ContentIssue[]) {
  const normalized = text(value, path, SHORT_TEXT_LIMIT, issues);
  if (normalized && !SAFE_ID.test(normalized)) addIssue(issues, path, "ID должен содержать строчные латинские буквы, цифры и дефисы.");
  return normalized;
}

function requiredPhone(value: unknown, path: string, issues: ContentIssue[]) {
  const normalized = optionalPhone(value, path, issues);
  if (!normalized) addIssue(issues, path, "Обязательное поле.");
  return normalized ?? "";
}

function requiredEmail(value: unknown, path: string, issues: ContentIssue[]) {
  const normalized = optionalEmail(value, path, issues);
  if (!normalized) addIssue(issues, path, "Обязательное поле.");
  return normalized ?? "";
}

function stringArray(
  value: unknown,
  path: string,
  maxLength: number,
  issues: ContentIssue[],
): string[] {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "Значение должно быть списком.");
    return [];
  }
  if (value.length > maxLength) addIssue(issues, path, `Не более ${maxLength} элементов.`);
  return value.map((item, index) => text(item, `${path}[${index}]`, PARAGRAPH_LIMIT, issues));
}

function parseBenefits(value: unknown, issues: ContentIssue[]) {
  if (!Array.isArray(value)) {
    addIssue(issues, "home.benefits", "Значение должно быть списком.");
    return [];
  }
  if (value.length > MAX_BENEFITS) addIssue(issues, "home.benefits", "Не более 6 элементов.");

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

function parseAboutStatistics(value: unknown, issues: ContentIssue[]) {
  if (!Array.isArray(value)) {
    addIssue(issues, "about.statistics", "Значение должно быть списком.");
    return [];
  }
  if (value.length > MAX_ABOUT_STATISTICS) {
    addIssue(issues, "about.statistics", "Не более 6 элементов.");
  }
  return value.map((statistic, index) => {
    const path = `about.statistics[${index}]`;
    const record = exactObject(
      statistic,
      path,
      ["value", "label"],
      issues,
    );
    return {
      value: text(record?.value, `${path}.value`, SHORT_TEXT_LIMIT, issues),
      label: text(record?.label, `${path}.label`, SHORT_TEXT_LIMIT, issues),
    };
  });
}

function parseLeadForm(value: unknown, issues: ContentIssue[]): LeadFormContentV1 {
  const path = "contacts.form";
  const keys = [
    "title",
    "nameLabel",
    "namePlaceholder",
    "contactLabel",
    "contactPlaceholder",
    "messageLabel",
    "submitLabel",
    "submittingLabel",
    "successTitle",
    "successHelper",
    "errorText",
  ] as const;
  const record = exactObject(value, path, keys, issues);
  return {
    title: text(record?.title, `${path}.title`, SHORT_TEXT_LIMIT, issues),
    nameLabel: text(record?.nameLabel, `${path}.nameLabel`, SHORT_TEXT_LIMIT, issues),
    namePlaceholder: text(record?.namePlaceholder, `${path}.namePlaceholder`, SHORT_TEXT_LIMIT, issues),
    contactLabel: text(record?.contactLabel, `${path}.contactLabel`, SHORT_TEXT_LIMIT, issues),
    contactPlaceholder: text(record?.contactPlaceholder, `${path}.contactPlaceholder`, SHORT_TEXT_LIMIT, issues),
    messageLabel: text(record?.messageLabel, `${path}.messageLabel`, SHORT_TEXT_LIMIT, issues),
    submitLabel: text(record?.submitLabel, `${path}.submitLabel`, SHORT_TEXT_LIMIT, issues),
    submittingLabel: text(record?.submittingLabel, `${path}.submittingLabel`, SHORT_TEXT_LIMIT, issues),
    successTitle: text(record?.successTitle, `${path}.successTitle`, SHORT_TEXT_LIMIT, issues),
    successHelper: text(record?.successHelper, `${path}.successHelper`, PARAGRAPH_LIMIT, issues),
    errorText: text(record?.errorText, `${path}.errorText`, PARAGRAPH_LIMIT, issues),
  };
}

function parseMember(value: unknown, index: number, issues: ContentIssue[]): TeamMemberV1 {
  const path = `team.members[${index}]`;
  const record = exactObject(
    value,
    path,
    ["id", "name", "role", "description", "phone", "email", "telegram", "imageId", "topnlabAgentId", "isVisible"],
    issues,
    ["role", "description", "phone", "email", "telegram", "imageId", "topnlabAgentId"],
  );
  const phone = optionalPhone(record?.phone, `${path}.phone`, issues);
  const email = optionalEmail(record?.email, `${path}.email`, issues);
  const telegram = optionalTelegram(record?.telegram, `${path}.telegram`, issues);
  const isVisible = record?.isVisible;
  if (typeof isVisible !== "boolean") addIssue(issues, `${path}.isVisible`, "Выберите допустимое состояние.");
  if (isVisible === true && !phone && !email && !telegram) {
    addIssue(issues, path, "Для видимого сотрудника укажите телефон, E-mail или Telegram.");
  }

  return {
    id: shortId(record?.id, `${path}.id`, issues),
    name: text(record?.name, `${path}.name`, SHORT_TEXT_LIMIT, issues),
    ...(record?.role === undefined ? {} : { role: optionalText(record.role, `${path}.role`, SHORT_TEXT_LIMIT, issues) }),
    ...(record?.description === undefined
      ? {}
      : { description: optionalText(record.description, `${path}.description`, PARAGRAPH_LIMIT, issues) }),
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
    addIssue(issues, "team.members", "Значение должно быть списком.");
    return [];
  }
  if (value.length > MAX_TEAM_MEMBERS) addIssue(issues, "team.members", "Не более 30 элементов.");

  const members = value.map((member, index) => parseMember(member, index, issues));
  const cardIds = new Set<string>();
  const agentIds = new Set<string>();
  for (const [index, member] of members.entries()) {
    if (member.id && cardIds.has(member.id)) addIssue(issues, `team.members[${index}].id`, "Значение должно быть уникальным.");
    cardIds.add(member.id);
    if (member.topnlabAgentId) {
      if (agentIds.has(member.topnlabAgentId)) {
        addIssue(issues, `team.members[${index}].topnlabAgentId`, "Значение должно быть уникальным.");
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

  if (root.schemaVersion !== 1) addIssue(issues, "schemaVersion", "Неподдерживаемая версия данных.");

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
    ["title", "introduction", "servicesTitle", "services", "closingText", "statistics", "teamCta", "teamCtaText"],
    issues,
  );
  const team = exactObject(root.team, "team", ["title", "introduction", "members"], issues);
  const contacts = exactObject(
    root.contacts,
    "contacts",
    [
      "title",
      "introduction",
      "managersTitle",
      "phoneLabel",
      "emailLabel",
      "addressLabel",
      "address",
      "phone",
      "email",
      "businessHoursLabel",
      "businessHours",
      "routeCta",
      "form",
    ],
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
      statistics: parseAboutStatistics(about?.statistics, issues),
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
      introduction: displayText(contacts?.introduction, "contacts.introduction", PARAGRAPH_LIMIT, issues),
      managersTitle: text(contacts?.managersTitle, "contacts.managersTitle", SHORT_TEXT_LIMIT, issues),
      phoneLabel: text(contacts?.phoneLabel, "contacts.phoneLabel", SHORT_TEXT_LIMIT, issues),
      emailLabel: text(contacts?.emailLabel, "contacts.emailLabel", SHORT_TEXT_LIMIT, issues),
      addressLabel: text(contacts?.addressLabel, "contacts.addressLabel", SHORT_TEXT_LIMIT, issues),
      address: text(contacts?.address, "contacts.address", SHORT_TEXT_LIMIT, issues),
      phone: requiredPhone(contacts?.phone, "contacts.phone", issues),
      email: requiredEmail(contacts?.email, "contacts.email", issues),
      businessHoursLabel: text(contacts?.businessHoursLabel, "contacts.businessHoursLabel", SHORT_TEXT_LIMIT, issues),
      businessHours: displayText(contacts?.businessHours, "contacts.businessHours", SHORT_TEXT_LIMIT, issues),
      routeCta: text(contacts?.routeCta, "contacts.routeCta", SHORT_TEXT_LIMIT, issues),
      form: parseLeadForm(contacts?.form, issues),
    },
  };

  return issues.length ? { success: false, issues } : { success: true, data };
}

export function parseSiteContent(value: unknown): SiteContentV1 {
  const result = safeParseSiteContent(value);
  if (!result.success) throw new SiteContentValidationError(result.issues);
  return result.data;
}
