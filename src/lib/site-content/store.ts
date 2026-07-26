import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { DEFAULT_SITE_CONTENT } from "./defaults";
import { parseSiteContent, type SiteContentV1 } from "./schema";

const SITE_CONTENT_ID = "site";

type StoredContentRow = {
  draft: unknown;
  published: unknown;
  previousPublished: unknown | null;
};

type SiteContentClient = {
  siteContent: {
    findUnique(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  $transaction<T>(
    run: (transaction: unknown) => Promise<T>,
  ): Promise<T>;
};

export type SiteContentStorageErrorCode =
  | "MISSING_CONTENT"
  | "INVALID_STORED_CONTENT";

export class SiteContentStorageError extends Error {
  constructor(readonly code: SiteContentStorageErrorCode) {
    super("Stored site content is unavailable");
    this.name = "SiteContentStorageError";
  }
}

export class SiteContentConflictError extends Error {
  readonly code = "NO_PREVIOUS_PUBLISHED";

  constructor() {
    super("No previous publication is available");
    this.name = "SiteContentConflictError";
  }
}

function asClient(client: unknown): SiteContentClient {
  return client as SiteContentClient;
}

function cloneDefault(): SiteContentV1 {
  return structuredClone(DEFAULT_SITE_CONTENT);
}

function asStoredRow(value: unknown): StoredContentRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SiteContentStorageError("MISSING_CONTENT");
  }
  const record = value as Record<string, unknown>;
  return {
    draft: record.draft,
    published: record.published,
    previousPublished: record.previousPublished ?? null,
  };
}

function parseStoredContent(value: unknown): SiteContentV1 {
  try {
    return parseSiteContent(value);
  } catch {
    throw new SiteContentStorageError("INVALID_STORED_CONTENT");
  }
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === null ? null : toInputJson(item),
    );
  }
  if (value && typeof value === "object") {
    const result: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) {
        result[key] = item === null ? null : toInputJson(item);
      }
    }
    return result;
  }
  throw new TypeError("Site content contains a non-JSON value");
}

async function findContentRow(
  client: SiteContentClient,
  select: Record<string, true>,
): Promise<StoredContentRow> {
  const row = await client.siteContent.findUnique({
    where: { id: SITE_CONTENT_ID },
    select,
  });
  return asStoredRow(row);
}

export function createSiteContentStore(client: unknown) {
  const database = asClient(client);

  async function getPublishedContent(): Promise<SiteContentV1> {
    try {
      const row = await findContentRow(database, { published: true });
      return parseStoredContent(row.published);
    } catch {
      console.error("site_content_fallback");
      return cloneDefault();
    }
  }

  async function getDraftContent(): Promise<SiteContentV1> {
    const row = await findContentRow(database, { draft: true });
    return parseStoredContent(row.draft);
  }

  async function saveDraft(input: unknown): Promise<SiteContentV1> {
    const draft = parseSiteContent(input);
    const row = asStoredRow(
      await database.siteContent.update({
        where: { id: SITE_CONTENT_ID },
        data: {
          draft: toInputJson(draft),
          draftUpdatedAt: new Date(),
        },
        select: { draft: true },
      }),
    );
    return parseStoredContent(row.draft);
  }

  async function publishDraft(): Promise<SiteContentV1> {
    return database.$transaction(async (rawTransaction) => {
      const transaction = asClient(rawTransaction);
      const row = await findContentRow(transaction, {
        draft: true,
        published: true,
      });
      const draft = parseStoredContent(row.draft);
      const published = parseStoredContent(row.published);
      const updated = asStoredRow(
        await transaction.siteContent.update({
          where: { id: SITE_CONTENT_ID },
          data: {
            previousPublished: toInputJson(published),
            published: toInputJson(draft),
            publishedAt: new Date(),
          },
          select: { published: true },
        }),
      );
      return parseStoredContent(updated.published);
    });
  }

  async function rollbackPublished(): Promise<SiteContentV1> {
    return database.$transaction(async (rawTransaction) => {
      const transaction = asClient(rawTransaction);
      const row = await findContentRow(transaction, {
        published: true,
        previousPublished: true,
      });
      if (row.previousPublished === null) {
        throw new SiteContentConflictError();
      }
      const published = parseStoredContent(row.published);
      const previousPublished = parseStoredContent(row.previousPublished);
      const updated = asStoredRow(
        await transaction.siteContent.update({
          where: { id: SITE_CONTENT_ID },
          data: {
            published: toInputJson(previousPublished),
            previousPublished: toInputJson(published),
            publishedAt: new Date(),
          },
          select: { published: true },
        }),
      );
      return parseStoredContent(updated.published);
    });
  }

  return {
    getPublishedContent,
    getDraftContent,
    saveDraft,
    publishDraft,
    rollbackPublished,
  };
}

const store = createSiteContentStore(db);

export const getPublishedContent = store.getPublishedContent;
export const getDraftContent = store.getDraftContent;
export const saveDraft = store.saveDraft;
export const publishDraft = store.publishDraft;
export const rollbackPublished = store.rollbackPublished;
