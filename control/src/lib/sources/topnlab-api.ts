import { hashIds, normalizeIds, type Fetcher, type SourceConfig, type SourceResult } from "./types";

function idsUrl(config: Pick<SourceConfig, "apiBaseUrl" | "apiKey">): string {
  const url = new URL("/public/get-ids", config.apiBaseUrl);
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("type", "realty");
  url.searchParams.set("action", "sale");
  url.searchParams.set("is_feed", "true");
  url.searchParams.set("deal_state", "ad");
  return url.toString();
}

export async function readTopnlabApi(
  config: Pick<SourceConfig, "apiBaseUrl" | "apiKey">,
  fetcher: Fetcher = fetch,
): Promise<SourceResult> {
  const startedAt = new Date();
  const response = await fetcher(idsUrl(config), { method: "GET" });
  if (!response.ok) throw new Error(`TOPNLAB_IDS_HTTP_${response.status}`);

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("TOPNLAB_IDS_SHAPE");
  const ids = normalizeIds(payload);
  if (ids.length === 0) throw new Error("TOPNLAB_IDS_EMPTY");

  return {
    source: "api",
    ids,
    rawEntities: new Map(),
    startedAt,
    finishedAt: new Date(),
    idsSha256: hashIds(ids),
  };
}
