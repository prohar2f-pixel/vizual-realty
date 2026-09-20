import type { SourceName, SourceResult } from "../sources/types";

export type CandidateIssue = {
  ruleCode: "xml-not-in-site" | "site-not-in-xml" | "api-not-in-xml" | "xml-not-in-api";
  canonicalId: string;
  category: "exact";
  requiredSources: SourceName[];
  evidence: Record<string, unknown>;
};

type Inputs = {
  xml: SourceResult | null;
  api: SourceResult | null;
  site: SourceResult | null;
};

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
    evidence: { presentIn: left.source, absentFrom: right.source },
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
  return issues;
}
