import { Pool } from "pg";
import type { Prisma } from "../../generated/prisma/client";

import { readControlConfig } from "../config";
import { db } from "../db";
import { readTopnlabApi } from "../sources/topnlab-api";
import { readSitePublishedIds } from "../sources/site-db";
import { readXmlFeed } from "../sources/xml-feed";
import type { SourceName, SourceResult } from "../sources/types";
import { evaluateSetDifferences } from "./rules";

const RULE_VERSION = "2026-09-20";

type SourceAttempt = { result: SourceResult | null; errorCode: string | null };

function errorCode(error: unknown): string {
  const value = error instanceof Error ? error.message : "SOURCE_UNKNOWN";
  return /^[A-Z0-9_]{3,80}$/.test(value) ? value : "SOURCE_UNAVAILABLE";
}

async function attempt(read: () => Promise<SourceResult>): Promise<SourceAttempt> {
  try { return { result: await read(), errorCode: null }; }
  catch (error) { return { result: null, errorCode: errorCode(error) }; }
}

function snapshotData(source: SourceName, attempt: SourceAttempt, startedAt: Date, finishedAt: Date) {
  return {
    source,
    status: attempt.result ? "success" as const : "failed" as const,
    readStartedAt: attempt.result?.startedAt ?? startedAt,
    readFinishedAt: attempt.result?.finishedAt ?? finishedAt,
    recordCount: attempt.result?.ids.length ?? null,
    idsSha256: attempt.result?.idsSha256 ?? null,
    errorCode: attempt.errorCode,
  };
}

export async function runAudit(trigger: "manual" | "scheduled") {
  const config = readControlConfig();
  const startedAt = new Date();
  const sitePool = new Pool({ connectionString: config.siteReadonlyDatabaseUrl });
  try {
    const [xml, api, site] = await Promise.all([
      attempt(() => readXmlFeed({ feedUrl: config.topnlabFeedUrl })),
      attempt(() => readTopnlabApi({ apiBaseUrl: config.topnlabBaseUrl, apiKey: config.topnlabKey })),
      attempt(() => readSitePublishedIds(sitePool)),
    ]);
    const finishedAt = new Date();
    const successful = [xml, api, site].filter((item) => item.result).length;
    const status = successful === 3 ? "success" : successful === 0 ? "failed" : "partial";
    const candidates = evaluateSetDifferences({ xml: xml.result, api: api.result, site: site.result });

    return db.$transaction(async (transaction) => {
      const auditRun = await transaction.auditRun.create({
        data: {
          trigger, status, ruleVersion: RULE_VERSION, startedAt, finishedAt,
          snapshots: { create: [
            snapshotData("xml", xml, startedAt, finishedAt),
            snapshotData("api", api, startedAt, finishedAt),
            snapshotData("site", site, startedAt, finishedAt),
          ] },
        },
      });
      for (const candidate of candidates) {
        const issue = await transaction.auditIssue.upsert({
          where: { ruleCode_canonicalId: { ruleCode: candidate.ruleCode, canonicalId: candidate.canonicalId } },
          update: { status: "open", lastSeenAt: finishedAt },
          create: { ruleCode: candidate.ruleCode, canonicalId: candidate.canonicalId, category: candidate.category, status: "open", firstSeenAt: finishedAt, lastSeenAt: finishedAt },
        });
        await transaction.auditIssueObservation.create({
          data: { auditRunId: auditRun.id, auditIssueId: issue.id, state: "seen", ruleVersion: RULE_VERSION, evidence: candidate.evidence as Prisma.InputJsonValue },
        });
      }
      return { id: auditRun.id, status, issues: candidates.length };
    });
  } finally {
    await sitePool.end();
  }
}
