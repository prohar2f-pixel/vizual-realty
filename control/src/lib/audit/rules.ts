import type { SourceName, SourceResult } from "../sources/types";

export type CandidateIssue = {
  ruleCode:
    | "xml-not-in-site" | "site-not-in-xml" | "api-not-in-xml" | "xml-not-in-api"
    | "active-not-in-ad" | "missing-price" | "missing-photos" | "missing-city"
    | "missing-agent" | "missing-area" | "missing-rooms" | "missing-floor"
    | "missing-floors" | "invalid-floor-range" | "missing-land-area"
    | "missing-district" | "missing-address" | "missing-description";
  canonicalId: string;
  category: "exact" | "advertising" | "quality";
  requiredSources: SourceName[];
  evidence: Record<string, unknown>;
};

type Inputs = {
  xml: SourceResult | null;
  api: SourceResult | null;
  apiAll?: SourceResult | null;
  site: SourceResult | null;
};

const qualityRules = {
  "missing-price": (entity: Record<string, unknown>) => entity.hasPrice !== true,
  "missing-photos": (entity: Record<string, unknown>) => typeof entity.photoCount !== "number" || entity.photoCount < 1,
  "missing-city": (entity: Record<string, unknown>) => typeof entity.cityName !== "string" || !entity.cityName,
  "missing-agent": (entity: Record<string, unknown>) => typeof entity.agentName !== "string" || !entity.agentName,
} as const;

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function qualityIssues(canonicalId: string, entity: Record<string, unknown>): CandidateIssue[] {
  const rules: CandidateIssue["ruleCode"][] = [];
  for (const [ruleCode, invalid] of Object.entries(qualityRules)) {
    if (invalid(entity)) rules.push(ruleCode as CandidateIssue["ruleCode"]);
  }
  if (typeof entity.districtName !== "string" || !entity.districtName) rules.push("missing-district");
  if (entity.hasAddress !== true) rules.push("missing-address");
  if (entity.hasDescription !== true) rules.push("missing-description");
  const type = entity.realtyType;
  if (type !== "land" && !positive(entity.area)) rules.push("missing-area");
  if (["flat", "room", "apartment"].includes(String(type))) {
    if (!positive(entity.rooms)) rules.push("missing-rooms");
    if (!positive(entity.floor)) rules.push("missing-floor");
    if (!positive(entity.floors)) rules.push("missing-floors");
    if (positive(entity.floor) && positive(entity.floors) && entity.floor > entity.floors) rules.push("invalid-floor-range");
  }
  if (["house", "cottage", "townhouse", "land"].includes(String(type)) && !positive(entity.landArea)) {
    rules.push("missing-land-area");
  }
  return rules.map((ruleCode) => ({
    ruleCode, canonicalId, category: "quality", requiredSources: ["api_all"],
    evidence: { ...entity },
  }));
}

function difference(
  left: SourceResult,
  right: SourceResult,
  ruleCode: CandidateIssue["ruleCode"],
): CandidateIssue[] {
  const rightIds = new Set(right.ids);
  return left.ids.filter((id) => !rightIds.has(id)).map((canonicalId) => ({
    ruleCode,
    canonicalId,
    category: "exact",
    requiredSources: [left.source, right.source],
    evidence: { presentIn: left.source, absentFrom: right.source, ...left.rawEntities.get(canonicalId), ...right.rawEntities.get(canonicalId) },
  }));
}

export function evaluateSetDifferences(input: Inputs): CandidateIssue[] {
  const issues: CandidateIssue[] = [];
  if (input.xml && input.site) {
    issues.push(...difference(input.xml, input.site, "xml-not-in-site"));
    issues.push(...difference(input.site, input.xml, "site-not-in-xml"));
  }
  if (input.api && input.xml) {
    issues.push(...difference(input.api, input.xml, "api-not-in-xml"));
    issues.push(...difference(input.xml, input.api, "xml-not-in-api"));
  }
  if (input.apiAll && input.api) {
    const advertisedIds = new Set(input.api.ids);
    for (const canonicalId of input.apiAll.ids) {
      const entity = input.apiAll.rawEntities.get(canonicalId);
      if (!entity) continue;
      const advertised = advertisedIds.has(canonicalId) || entity.inAd === true;
      if (!advertised && entity.dealState === "ad") {
        issues.push({
          ruleCode: "active-not-in-ad", canonicalId, category: "advertising",
          requiredSources: ["api_all", "api"], evidence: { ...entity },
        });
      }
      if (advertised || entity.dealState === "ad") issues.push(...qualityIssues(canonicalId, entity));
    }
  }
  return issues;
}

export function requiredSourcesForRule(ruleCode: string): SourceName[] {
  if (ruleCode === "xml-not-in-site" || ruleCode === "site-not-in-xml") return ["xml", "site"];
  if (ruleCode === "api-not-in-xml" || ruleCode === "xml-not-in-api") return ["api", "xml"];
  if (ruleCode === "active-not-in-ad") return ["api_all", "api"];
  if (ruleCode.startsWith("missing-") || ruleCode === "invalid-floor-range") return ["api_all"];
  return [];
}
