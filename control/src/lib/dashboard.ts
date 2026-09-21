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
  "api-not-in-xml": { title: "Есть в API Topnlab, но нет в XML-фиде", severity: "warning" },
  "xml-not-in-api": { title: "Есть в XML-фиде, но нет в API Topnlab", severity: "warning" },
  "xml-not-in-site": { title: "Есть в XML-фиде, но нет в каталоге сайта", severity: "error" },
  "site-not-in-xml": { title: "Есть в каталоге сайта, но нет в XML-фиде", severity: "error" },
} as const;

export function describeIssue(ruleCode: string) {
  return issueDescriptions[ruleCode as keyof typeof issueDescriptions] ?? {
    title: "Неизвестное правило проверки",
    severity: "warning" as const,
  };
}

export function summarizeSnapshots(snapshots: DashboardSnapshot[]) {
  const countFor = (source: string) => snapshots.find((snapshot) => snapshot.source === source)?.recordCount ?? 0;
  const xml = countFor("xml");
  const api = countFor("api");
  const site = countFor("site");
  return {
    xml,
    api,
    site,
    apiOnly: Math.max(api - xml, 0),
    xmlOnly: Math.max(xml - api, 0),
    siteOnly: Math.max(site - xml, 0),
  };
}

export type IssueListItem = { canonicalId: string; ruleCode: string };

export function filterIssues<T extends IssueListItem>(issues: T[], filters: { query: string; ruleCode: string }): T[] {
  const query = filters.query.trim();
  return issues.filter((issue) =>
    (!query || issue.canonicalId.includes(query)) &&
    (!filters.ruleCode || issue.ruleCode === filters.ruleCode),
  );
}

export function summarizeIssues(issues: IssueListItem[]) {
  const count = (ruleCode: string) => issues.filter((issue) => issue.ruleCode === ruleCode).length;
  return {
    apiOnly: count("api-not-in-xml"),
    xmlOnly: count("xml-not-in-api"),
    siteOnly: count("site-not-in-xml"),
    xmlOnlySite: count("xml-not-in-site"),
  };
}
