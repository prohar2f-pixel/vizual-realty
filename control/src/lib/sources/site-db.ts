import { hashIds, normalizeIds, type SourceResult } from "./types";

export type ReadonlySiteClient = {
  query: (sql: string) => Promise<{ rows: Array<{ id: unknown }> }>;
};

const PUBLISHED_IDS_QUERY = 'SELECT "id" FROM "Property" WHERE "isFeed" = true ORDER BY "id"';

export async function readSitePublishedIds(client: ReadonlySiteClient): Promise<SourceResult> {
  const startedAt = new Date();
  const result = await client.query(PUBLISHED_IDS_QUERY);
  const ids = normalizeIds(result.rows.map((row) => row.id));
  if (ids.length === 0) throw new Error("SITE_IDS_EMPTY");

  return {
    source: "site",
    ids,
    rawEntities: new Map(),
    startedAt,
    finishedAt: new Date(),
    idsSha256: hashIds(ids),
  };
}
