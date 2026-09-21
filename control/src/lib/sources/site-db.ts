import { hashIds, normalizeIds, type SourceResult } from "./types";

export type ReadonlySiteClient = {
  query: (sql: string) => Promise<{ rows: Array<{ id: unknown; agentName?: unknown }> }>;
};

const PUBLISHED_IDS_QUERY = 'SELECT p."id", a."name" AS "agentName" FROM "Property" p LEFT JOIN "Agent" a ON a."id" = p."agentId" WHERE p."isFeed" = true ORDER BY p."id"';

export async function readSitePublishedIds(client: ReadonlySiteClient): Promise<SourceResult> {
  const startedAt = new Date();
  const result = await client.query(PUBLISHED_IDS_QUERY);
  const ids = normalizeIds(result.rows.map((row) => row.id));
  if (ids.length === 0) throw new Error("SITE_IDS_EMPTY");

  return {
    source: "site",
    ids,
    rawEntities: new Map(result.rows.flatMap((row) => {
      const id = String(row.id).trim();
      const agentName = typeof row.agentName === "string" ? row.agentName.trim() : "";
      return id && agentName ? [[id, { agentName }]] : [];
    })),
    startedAt,
    finishedAt: new Date(),
    idsSha256: hashIds(ids),
  };
}
