import { Pool } from "pg";
import type { Prisma } from "../../generated/prisma/client";

import { readControlConfig } from "../config";
import { getDb } from "../db";
import { readTopnlabApi } from "../sources/topnlab-api";
import { readSitePublishedIds } from "../sources/site-db";
import { readXmlFeed } from "../sources/xml-feed";
import type { SourceName, SourceResult } from "../sources/types";
import { evaluateSetDifferences } from "./rules";

const RULE_VERSION = "2026-09-20";

type SourceAttempt = { result: SourceResult | null; errorCode: string | null };
export class AuditAlreadyRunningError extends Error { constructor() { super("AUDIT_ALREADY_RUNNING"); } }

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
  const db = getDb();
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
      const seenIssueKeys = new Set(candidates.map((candidate) => `${candidate.ruleCode}:${candidate.canonicalId}`));
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
      // A difference disappears only after both sources required by its rule completed successfully.
      const successfulSources = new Set([xml, api, site].flatMap((attempt) => attempt.result ? [attempt.result.source] : []));
      const activeIssues = await transaction.auditIssue.findMany({ where: { status: { in: ["open", "review", "stale"] } } });
      for (const issue of activeIssues) {
        if (seenIssueKeys.has(`${issue.ruleCode}:${issue.canonicalId}`)) continue;
        const required: Record<string, SourceName[]> = {
          "xml-not-in-site": ["xml", "site"], "site-not-in-xml": ["site", "xml"],
          "api-not-in-xml": ["api", "xml"], "xml-not-in-api": ["xml", "api"],
        };
        if (!required[issue.ruleCode]?.every((source) => successfulSources.has(source))) continue;
        await transaction.auditIssue.update({ where: { id: issue.id }, data: { status: "resolved", lastSeenAt: finishedAt } });
        await transaction.auditIssueObservation.create({ data: { auditRunId: auditRun.id, auditIssueId: issue.id, state: "not_seen", ruleVersion: RULE_VERSION, evidence: { resolvedBy: "complete-source-read" } } });
      }
      return { id: auditRun.id, status, issues: candidates.length };
    });
  } finally {
    await sitePool.end();
  }
}

export async function runLockedAudit(trigger: "manual" | "scheduled") {
  const config = readControlConfig();
  const lockPool = new Pool({ connectionString: config.controlDatabaseUrl, max: 1 });
  let locked = false;
  try {
    const result = await lockPool.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(hashtext('vizual-control-audit-v1')) AS locked");
    locked = result.rows[0]?.locked === true;
    if (!locked) throw new AuditAlreadyRunningError();
    return await runAudit(trigger);
  } finally {
    if (locked) await lockPool.query("SELECT pg_advisory_unlock(hashtext('vizual-control-audit-v1'))").catch(() => undefined);
    await lockPool.end();
  }
}
