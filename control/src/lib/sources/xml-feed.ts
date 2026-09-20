import { XMLParser } from "fast-xml-parser";

import { hashIds, normalizeIds, type Fetcher, type SourceConfig, type SourceResult } from "./types";

function collectOfferIds(value: unknown, ids: unknown[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectOfferIds(item, ids);
    return;
  }
  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  if ("@_internal-id" in record) ids.push(record["@_internal-id"]);
  for (const [key, child] of Object.entries(record)) {
    if (key !== "@_internal-id") collectOfferIds(child, ids);
  }
}

export async function readXmlFeed(
  config: Pick<SourceConfig, "feedUrl">,
  fetcher: Fetcher = fetch,
): Promise<SourceResult> {
  const startedAt = new Date();
  const response = await fetcher(config.feedUrl, { method: "GET" });
  if (!response.ok) throw new Error(`XML_FEED_HTTP_${response.status}`);

  const document = await response.text();
  let parsed: unknown;
  try {
    parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(document);
  } catch {
    throw new Error("XML_FEED_INVALID");
  }

  const rawIds: unknown[] = [];
  collectOfferIds(parsed, rawIds);
  const ids = normalizeIds(rawIds);
  if (ids.length === 0) throw new Error("XML_FEED_EMPTY");

  return {
    source: "xml",
    ids,
    rawEntities: new Map(),
    startedAt,
    finishedAt: new Date(),
    idsSha256: hashIds(ids),
  };
}
