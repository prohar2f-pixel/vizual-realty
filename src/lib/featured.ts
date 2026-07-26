import { Prisma } from "../generated/prisma/client";
import { db } from "./db";

export type PropertyCardData = {
  id: string;
  shortId: number | null;
  title: string;
  price: number;
  rooms: number | null;
  area: number | null;
  city: string | null;
  district: string | null;
  address: string | null;
  photo: string | null;
  agent: {
    id: string;
    name: string;
    phone: string | null;
    photoUrl: string | null;
  } | null;
};

export type AdminFeaturedPropertyCardData = PropertyCardData & {
  isFeed: boolean;
};

export type PropertySearchResult = {
  items: PropertyCardData[];
  total: number;
  page: number;
  pageSize: number;
};

export type FeaturedValidationCode =
  | "INVALID_COUNT"
  | "DUPLICATE_IDS"
  | "PROPERTY_NOT_PUBLIC"
  | "INVALID_SEARCH";

export class FeaturedValidationError extends Error {
  readonly code: FeaturedValidationCode;

  constructor(code: FeaturedValidationCode) {
    super("Featured property input is invalid");
    this.name = "FeaturedValidationError";
    this.code = code;
  }
}

type FeaturedPropertyRow = {
  property: {
    id: string;
    shortId: number | null;
    title: string;
    price: number;
    rooms: number | null;
    area: number | null;
    city: string | null;
    district: string | null;
    address: string | null;
    isFeed: boolean;
    agent: PropertyCardData["agent"];
  };
};

type SearchPropertyRow = Omit<PropertyCardData, "photo">;

type FeaturedDataClient = {
  property: {
    findMany(args: unknown): Promise<unknown>;
    count(args: unknown): Promise<number>;
  };
  featuredProperty: {
    findMany(args: unknown): Promise<unknown>;
    deleteMany(args?: unknown): Promise<unknown>;
    createMany(args: unknown): Promise<unknown>;
  };
  $queryRaw<T>(query: unknown): Promise<T>;
  $transaction<T>(run: (transaction: unknown) => Promise<T>): Promise<T>;
};

const cardSelection = {
  id: true,
  shortId: true,
  title: true,
  price: true,
  rooms: true,
  area: true,
  city: true,
  district: true,
  address: true,
  agent: {
    select: {
      id: true,
      name: true,
      phone: true,
      photoUrl: true,
    },
  },
} as const;

function asClient(client: unknown): FeaturedDataClient {
  return client as FeaturedDataClient;
}

function toCard(
  property: FeaturedPropertyRow["property"],
  photo: string | null,
): PropertyCardData {
  return {
    id: property.id,
    shortId: property.shortId,
    title: property.title,
    price: property.price,
    rooms: property.rooms,
    area: property.area,
    city: property.city,
    district: property.district,
    address: property.address,
    photo,
    agent: property.agent,
  };
}

async function readCoverPhotos(
  database: FeaturedDataClient,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, string | null>();
  const rows = await database.$queryRaw<Array<{ id: string; photo: string | null }>>(
    Prisma.sql`
      SELECT "id", "photos"[1] AS "photo"
      FROM "Property"
      WHERE "id" IN (${Prisma.join(ids)})
    `,
  );
  return new Map(rows.map(({ id, photo }) => [id, photo]));
}

async function readFeatured(
  onlyPublic: boolean,
  client: unknown,
): Promise<AdminFeaturedPropertyCardData[]> {
  const database = asClient(client);
  const rows = (await database.featuredProperty.findMany({
    ...(onlyPublic ? { where: { property: { isFeed: true } } } : {}),
    orderBy: { position: "asc" },
    select: {
      property: {
        select: {
          ...cardSelection,
          isFeed: true,
        },
      },
    },
  })) as FeaturedPropertyRow[];
  const photos = await readCoverPhotos(
    database,
    rows.map(({ property }) => property.id),
  );

  return rows.map(({ property }) => ({
    ...toCard(property, photos.get(property.id) ?? null),
    isFeed: property.isFeed,
  }));
}

export async function getFeaturedProperties(
  client: unknown = db,
): Promise<PropertyCardData[]> {
  const rows = await readFeatured(true, client);
  return rows.map((item) => ({
    id: item.id,
    shortId: item.shortId,
    title: item.title,
    price: item.price,
    rooms: item.rooms,
    area: item.area,
    city: item.city,
    district: item.district,
    address: item.address,
    photo: item.photo,
    agent: item.agent,
  }));
}

export function getAdminFeaturedProperties(
  client: unknown = db,
): Promise<AdminFeaturedPropertyCardData[]> {
  return readFeatured(false, client);
}

function validateFeaturedIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 3) {
    throw new FeaturedValidationError("INVALID_COUNT");
  }
  if (!ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 256)) {
    throw new FeaturedValidationError("PROPERTY_NOT_PUBLIC");
  }
  if (new Set(ids).size !== ids.length) {
    throw new FeaturedValidationError("DUPLICATE_IDS");
  }
  return ids;
}

export async function replaceFeaturedPropertyIds(
  ids: unknown,
  client: unknown = db,
): Promise<void> {
  const validIds = validateFeaturedIds(ids);
  const database = asClient(client);
  const rows = (await database.property.findMany({
    where: { id: { in: validIds }, isFeed: true },
    select: { id: true },
  })) as Array<{ id: string }>;
  const found = new Set(rows.map(({ id }) => id));
  if (validIds.some((id) => !found.has(id))) {
    throw new FeaturedValidationError("PROPERTY_NOT_PUBLIC");
  }

  await database.$transaction(async (rawTransaction) => {
    const transaction = asClient(rawTransaction);
    await transaction.featuredProperty.deleteMany();
    await transaction.featuredProperty.createMany({
      data: validIds.map((propertyId, index) => ({
        propertyId,
        position: index + 1,
      })),
    });
  });
}

function validateSearchInput(input: {
  query: string;
  page: number;
  pageSize: number;
}) {
  if (
    typeof input.query !== "string" ||
    input.query.length > 120 ||
    !Number.isSafeInteger(input.page) ||
    input.page < 1 ||
    !Number.isSafeInteger(input.pageSize) ||
    input.pageSize < 1 ||
    input.pageSize > 20 ||
    (input.page - 1) * input.pageSize > 2_147_483_647
  ) {
    throw new FeaturedValidationError("INVALID_SEARCH");
  }
  return { ...input, query: input.query.trim() };
}

function numericShortId(query: string): number | null {
  if (!/^\d{1,10}$/.test(query)) return null;
  const value = Number(query);
  return value <= 2_147_483_647 ? value : null;
}

export async function searchPublicProperties(
  input: { query: string; page: number; pageSize: number },
  client: unknown = db,
): Promise<PropertySearchResult> {
  const { query, page, pageSize } = validateSearchInput(input);
  const database = asClient(client);
  const shortId = numericShortId(query);
  const where = {
    isFeed: true,
    ...(query
      ? {
          OR: [
            { id: query },
            ...(shortId === null ? [] : [{ shortId }]),
            { title: { contains: query, mode: "insensitive" } },
            { address: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rawItems, total] = await Promise.all([
    database.property.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: cardSelection,
    }) as Promise<SearchPropertyRow[]>,
    database.property.count({ where }),
  ]);

  const photos = await readCoverPhotos(
    database,
    rawItems.map(({ id }) => id),
  );

  return {
    items: rawItems.map((item) => ({
      ...item,
      photo: photos.get(item.id) ?? null,
    })),
    total,
    page,
    pageSize,
  };
}
