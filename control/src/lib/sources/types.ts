import { createHash } from "node:crypto";

export type SourceName = "xml" | "api" | "api_all" | "site";

export type SourceResult = {
  source: SourceName;
  ids: string[];
  rawEntities: Map<string, Record<string, unknown>>;
  startedAt: Date;
  finishedAt: Date;
  idsSha256: string;
};

export type SourceConfig = {
  feedUrl: string;
  apiBaseUrl: string;
  apiKey: string;
};

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export function normalizeIds(values: Iterable<unknown>): string[] {
  const ids = new Set<string>();
  for (const value of values) {
    const id = String(value).trim();
    if (id) ids.add(id);
  }
  return [...ids].sort((left, right) => left.localeCompare(right, "en"));
}

export function hashIds(ids: readonly string[]): string {
  return createHash("sha256").update(ids.join("\n"), "utf8").digest("hex");
}
