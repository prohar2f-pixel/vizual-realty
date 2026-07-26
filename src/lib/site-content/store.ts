import { Prisma } from "../../generated/prisma/client";
import { isDatabaseAvailabilityError } from "../database-errors";
import { db } from "../db";
import { validateConfiguredTeamImageReferences } from "../team-image-files";
import { DEFAULT_SITE_CONTENT } from "./defaults";
import { withSiteContentMutationLock } from "./mutation-lock";
import {
  parseSiteContent,
  SiteContentValidationError,
  type SiteContentV1,
} from "./schema";

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
  $queryRaw<T>(query: unknown): Promise<T>;
  $transaction<T>(
    run: (transaction: unknown) => Promise<T>,
  ): Promise<T>;
};

type SiteContentStoreOptions = {
  validateDraftImages?: (draft: SiteContentV1) => Promise<void>;
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

export type SiteContentStatus = {
  draftUpdatedAt: Date;
  publishedAt: Date | null;
  canRollback: boolean;
};

export type SiteContentMutationResult = {
  content: SiteContentV1;
  status: SiteContentStatus;
};

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

const LEGACY_TEAM_CTA_TEXT =
  "В разделе КОМАНДА Вы можете выбрать для работы любого менеджера нашей компании и позвонить ему напрямую 🤝";

function asPlainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as Record<string, unknown>)
    : null;
}

function hydrateExactLegacyV1(value: unknown): unknown {
  const root = asPlainRecord(value);
  const about = asPlainRecord(root?.about);
  const contacts = asPlainRecord(root?.contacts);
  if (
    root?.schemaVersion !== 1 ||
    !about ||
    !contacts ||
    Object.hasOwn(about, "statistics") ||
    Object.hasOwn(contacts, "introduction") ||
    Object.hasOwn(contacts, "businessHoursLabel") ||
    Object.hasOwn(contacts, "businessHours") ||
    Object.hasOwn(contacts, "form")
  ) {
    return value;
  }

  return {
    ...root,
    about: {
      ...about,
      statistics: structuredClone(DEFAULT_SITE_CONTENT.about.statistics),
      teamCtaText:
        about.teamCtaText === LEGACY_TEAM_CTA_TEXT
          ? DEFAULT_SITE_CONTENT.about.teamCtaText
          : about.teamCtaText,
    },
    contacts: {
      ...contacts,
      introduction: DEFAULT_SITE_CONTENT.contacts.introduction,
      businessHoursLabel:
        DEFAULT_SITE_CONTENT.contacts.businessHoursLabel,
      businessHours: DEFAULT_SITE_CONTENT.contacts.businessHours,
      form: structuredClone(DEFAULT_SITE_CONTENT.contacts.form),
    },
  };
}

function parseStoredContent(value: unknown): SiteContentV1 {
  try {
    return parseSiteContent(hydrateExactLegacyV1(value));
  } catch (error) {
    if (error instanceof SiteContentValidationError) {
      throw new SiteContentStorageError("INVALID_STORED_CONTENT");
    }
    throw error;
  }
}

function parseStoredDate(value: unknown, nullable: boolean): Date | null {
  if (nullable && value === null) return null;
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new SiteContentStorageError("INVALID_STORED_CONTENT");
  }
  return value;
}

function parseSiteContentStatusRow(value: unknown): SiteContentStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SiteContentStorageError("MISSING_CONTENT");
  }
  const record = value as Record<string, unknown>;
  if (!Object.hasOwn(record, "previousPublished")) {
    throw new SiteContentStorageError("INVALID_STORED_CONTENT");
  }
  return {
    draftUpdatedAt: parseStoredDate(record.draftUpdatedAt, false) as Date,
    publishedAt: parseStoredDate(record.publishedAt, true),
    canRollback: record.previousPublished !== null,
  };
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

async function lockContentRow(client: SiteContentClient): Promise<void> {
  await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "SiteContent"
    WHERE "id" = ${SITE_CONTENT_ID}
    FOR UPDATE
  `);
}

export function createSiteContentStore(
  client: unknown,
  options: SiteContentStoreOptions = {},
) {
  const database = asClient(client);
  const validateDraftImages =
    options.validateDraftImages ?? validateConfiguredTeamImageReferences;

  async function getPublishedContent(): Promise<SiteContentV1> {
    try {
      const row = await findContentRow(database, { published: true });
      return parseStoredContent(row.published);
    } catch (error) {
      if (
        !(error instanceof SiteContentStorageError) &&
        !isDatabaseAvailabilityError(error)
      ) {
        throw error;
      }
      console.error("site_content_fallback");
      return cloneDefault();
    }
  }

  async function getDraftContent(): Promise<SiteContentV1> {
    const row = await findContentRow(database, { draft: true });
    return parseStoredContent(row.draft);
  }

  async function getSiteContentStatus(): Promise<SiteContentStatus> {
    const row = await database.siteContent.findUnique({
      where: { id: SITE_CONTENT_ID },
      select: {
        draftUpdatedAt: true,
        publishedAt: true,
        previousPublished: true,
      },
    });
    return parseSiteContentStatusRow(row);
  }

  async function saveDraft(input: unknown): Promise<SiteContentV1> {
    const draft = parseSiteContent(input);
    return withSiteContentMutationLock(database, async (rawTransaction) => {
      const transaction = asClient(rawTransaction);
      const current = await findContentRow(transaction, { draft: true });
      parseStoredContent(current.draft);
      await validateDraftImages(draft);
      const row = asStoredRow(
        await transaction.siteContent.update({
          where: { id: SITE_CONTENT_ID },
          data: {
            draft: toInputJson(draft),
            draftUpdatedAt: new Date(),
          },
          select: { draft: true },
        }),
      );
      return parseStoredContent(row.draft);
    });
  }

  async function publishDraftWithStatus(): Promise<SiteContentMutationResult> {
    return withSiteContentMutationLock(database, async (rawTransaction) => {
      const transaction = asClient(rawTransaction);
      await lockContentRow(transaction);
      const row = await findContentRow(transaction, {
        draft: true,
        published: true,
      });
      const draft = parseStoredContent(row.draft);
      const published = parseStoredContent(row.published);
      const updated = await transaction.siteContent.update({
        where: { id: SITE_CONTENT_ID },
        data: {
          previousPublished: toInputJson(published),
          published: toInputJson(draft),
          publishedAt: new Date(),
        },
        select: {
          published: true,
          previousPublished: true,
          draftUpdatedAt: true,
          publishedAt: true,
        },
      });
      const stored = asStoredRow(updated);
      return {
        content: parseStoredContent(stored.published),
        status: parseSiteContentStatusRow(updated),
      };
    });
  }

  async function publishDraft(): Promise<SiteContentV1> {
    return (await publishDraftWithStatus()).content;
  }

  async function rollbackPublishedWithStatus(): Promise<SiteContentMutationResult> {
    return withSiteContentMutationLock(database, async (rawTransaction) => {
      const transaction = asClient(rawTransaction);
      await lockContentRow(transaction);
      const row = await findContentRow(transaction, {
        published: true,
        previousPublished: true,
      });
      if (row.previousPublished === null) {
        throw new SiteContentConflictError();
      }
      const published = parseStoredContent(row.published);
      const previousPublished = parseStoredContent(row.previousPublished);
      const updated = await transaction.siteContent.update({
        where: { id: SITE_CONTENT_ID },
        data: {
          published: toInputJson(previousPublished),
          previousPublished: toInputJson(published),
          publishedAt: new Date(),
        },
        select: {
          published: true,
          previousPublished: true,
          draftUpdatedAt: true,
          publishedAt: true,
        },
      });
      const stored = asStoredRow(updated);
      return {
        content: parseStoredContent(stored.published),
        status: parseSiteContentStatusRow(updated),
      };
    });
  }

  async function rollbackPublished(): Promise<SiteContentV1> {
    return (await rollbackPublishedWithStatus()).content;
  }

  return {
    getPublishedContent,
    getDraftContent,
    getSiteContentStatus,
    saveDraft,
    publishDraftWithStatus,
    publishDraft,
    rollbackPublishedWithStatus,
    rollbackPublished,
  };
}

const store = createSiteContentStore(db);

export const getPublishedContent = store.getPublishedContent;
export const getDraftContent = store.getDraftContent;
export const getSiteContentStatus = store.getSiteContentStatus;
export const saveDraft = store.saveDraft;
export const publishDraftWithStatus = store.publishDraftWithStatus;
export const publishDraft = store.publishDraft;
export const rollbackPublishedWithStatus = store.rollbackPublishedWithStatus;
export const rollbackPublished = store.rollbackPublished;
