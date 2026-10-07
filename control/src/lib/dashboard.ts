export type DashboardSnapshot = {
  source: string;
  status: string;
  recordCount: number | null;
};

export function formatMoscowDate(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

const issueDescriptions = {
  "api-not-in-xml": {
    title: "Объект находится в рекламе по данным API, но отсутствует в XML-фиде",
    severity: "error",
    details: "API Topnlab с параметром in_ad вернул объект, но рекламный пакет «Корпоративный сайт» не передал его в XML-фид. Передайте ID в поддержку Topnlab.",
  },
  "xml-not-in-api": {
    title: "Объект есть в XML-фиде, но отсутствует среди объектов в рекламе по API",
    severity: "warning",
    details: "Фид рекламного пакета «Корпоративный сайт» содержит объект, которого нет в ответе API с параметром in_ad. Это расхождение нужно проверять с поддержкой Topnlab.",
  },
  "xml-not-in-site": { title: "Есть в XML-фиде, но нет в каталоге сайта", severity: "error" },
  "site-not-in-xml": { title: "Есть в каталоге сайта, но нет в XML-фиде", severity: "error" },
  "active-not-in-ad": {
    title: "Действующий объект не добавлен в рекламу", severity: "error",
    details: "Карточка находится на рабочем этапе, но рекламный пакет «Корпоративный сайт» не активирован. Проверьте раздел «Сервисы» объекта в Topnlab.",
  },
  "missing-price": { title: "Не указана цена", severity: "error", details: "Заполните цену объекта в Topnlab." },
  "missing-photos": { title: "Нет фотографий", severity: "error", details: "Добавьте хотя бы одну фотографию объекта в Topnlab." },
  "missing-city": { title: "Не указан город", severity: "error", details: "Заполните город или населённый пункт в Topnlab." },
  "missing-agent": { title: "Не указан ответственный", severity: "error", details: "Назначьте ответственного сотрудника в Topnlab." },
  "missing-area": { title: "Не указана площадь объекта", severity: "error", details: "Заполните общую площадь объекта в Topnlab." },
  "missing-rooms": { title: "Не указано количество комнат", severity: "error", details: "Заполните количество комнат в Topnlab." },
  "missing-floor": { title: "Не указан этаж", severity: "error", details: "Заполните этаж объекта в Topnlab." },
  "missing-floors": { title: "Не указана этажность дома", severity: "error", details: "Заполните общее количество этажей дома в Topnlab." },
  "invalid-floor-range": { title: "Этаж выше этажности дома", severity: "error", details: "Проверьте значения этажа и этажности в Topnlab." },
  "missing-land-area": { title: "Не указана площадь участка", severity: "error", details: "Заполните площадь земельного участка в Topnlab." },
  "missing-district": { title: "Не указан район", severity: "warning", details: "Добавьте район в Topnlab — это улучшит фильтрацию и карточку объекта." },
  "missing-address": { title: "Не заполнен адрес", severity: "warning", details: "Добавьте адрес объекта в Topnlab. Номер дома на публичном сайте всё равно будет скрыт." },
  "missing-description": { title: "Не заполнено описание", severity: "warning", details: "Добавьте описание объекта в Topnlab — это не блокирует выгрузку, но снижает качество карточки." },
} as const;

export function describeIssue(ruleCode: string) {
  return issueDescriptions[ruleCode as keyof typeof issueDescriptions] ?? {
    title: "Неизвестное правило проверки",
    severity: "warning" as const,
  };
}

export function summarizeSnapshots(snapshots: DashboardSnapshot[]) {
  const countFor = (source: string) => snapshots.find((snapshot) => snapshot.source === source)?.recordCount ?? 0;
  const apiAll = countFor("api_all");
  const xml = countFor("xml");
  const api = countFor("api");
  const site = countFor("site");
  return {
    apiAll, xml,
    api,
    site,
    notInAd: Math.max(apiAll - api, 0),
    apiOnly: Math.max(api - xml, 0),
    xmlOnly: Math.max(xml - api, 0),
    siteOnly: Math.max(site - xml, 0),
  };
}

export type IssueListItem = { canonicalId: string; ruleCode: string; agentName?: string | null; realtyType?: string | null; evidence?: Record<string, unknown> };

export const UNASSIGNED_AGENT_FILTER = "__unassigned__";
export type PropertyTypeFilter = "flat" | "house" | "land" | "other";

function propertyTypeGroup(value: string | null | undefined): PropertyTypeFilter {
  const type = value?.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  if (!type) return "other";
  if (["flat", "apartment", "room", "квартира", "комната", "апартаменты"].includes(type)) return "flat";
  if (["house", "cottage", "townhouse", "дом", "коттедж", "таунхаус", "дача"].includes(type)) return "house";
  if (["land", "plot", "lot", "участок", "земельный участок"].includes(type)) return "land";
  return "other";
}

const qualityRuleCodes = new Set(["missing-price", "missing-photos", "missing-city", "missing-agent", "missing-area", "missing-rooms", "missing-floor", "missing-floors", "invalid-floor-range", "missing-land-area", "missing-district", "missing-address", "missing-description"]);

export function issueGroup(ruleCode: string): "support" | "advertising" | "quality" | "sync" {
  if (ruleCode === "api-not-in-xml" || ruleCode === "xml-not-in-api") return "support";
  if (ruleCode === "active-not-in-ad") return "advertising";
  if (qualityRuleCodes.has(ruleCode)) return "quality";
  return "sync";
}

export function needsTopnlabSupport(issue: IssueListItem): boolean {
  return issue.ruleCode === "api-not-in-xml" || issue.ruleCode === "xml-not-in-api";
}

export function filterIssues<T extends IssueListItem>(issues: T[], filters: { query: string; ruleCode: string; group?: string; agentName?: string; propertyType?: string; supportOnly?: boolean }): T[] {
  const query = filters.query.trim().toLocaleLowerCase("ru");
  return issues.filter((issue) =>
    (!query || issue.canonicalId.includes(query) || issue.agentName?.toLocaleLowerCase("ru").includes(query)) &&
    (!filters.ruleCode || issue.ruleCode === filters.ruleCode) &&
    (!filters.group || issueGroup(issue.ruleCode) === filters.group) &&
    (!filters.agentName || (filters.agentName === UNASSIGNED_AGENT_FILTER ? !issue.agentName?.trim() : issue.agentName?.trim() === filters.agentName)) &&
    (!filters.propertyType || propertyTypeGroup(issue.realtyType) === filters.propertyType) &&
    (!filters.supportOnly || needsTopnlabSupport(issue)),
  );
}

export function summarizeIssues(issues: IssueListItem[]) {
  const count = (ruleCode: string) => issues.filter((issue) => issue.ruleCode === ruleCode).length;
  const uniqueObjects = (group: ReturnType<typeof issueGroup>) => new Set(
    issues.filter((issue) => issueGroup(issue.ruleCode) === group).map((issue) => issue.canonicalId),
  ).size;
  return {
    apiOnly: count("api-not-in-xml"),
    xmlOnly: count("xml-not-in-api"),
    siteOnly: count("site-not-in-xml"),
    xmlOnlySite: count("xml-not-in-site"),
    activeNotInAd: uniqueObjects("advertising"),
    quality: uniqueObjects("quality"),
  };
}
