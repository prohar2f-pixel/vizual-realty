export type CatalogSearchParams = {
  article?: string;
  objectType?: string;
  city?: string;
  district?: string;
  rooms?: string;
  priceMin?: string;
  priceMax?: string;
};

const OBJECT_TYPES = new Set(["flat", "house", "land"]);
const ROOM_VALUES = new Set(["1", "2", "3", "4"]);

function articleWhere(value: string | undefined): Record<string, unknown>[] | undefined {
  const article = value?.trim();
  if (!article || !/^\d{1,20}$/.test(article)) return undefined;

  const matching: Record<string, unknown>[] = [{ id: article }];
  const shortId = Number(article);
  if (Number.isSafeInteger(shortId) && shortId <= 2_147_483_647) {
    matching.push({ shortId });
  }
  return matching;
}

function priceBound(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : undefined;
}

export function buildCatalogWhere(
  params: CatalogSearchParams,
): Record<string, unknown> {
  const where: Record<string, unknown> = { isFeed: true };

  const article = articleWhere(params.article);
  if (article) where.OR = article;

  if (params.objectType && OBJECT_TYPES.has(params.objectType)) {
    where.objectType = params.objectType;
  }
  if (params.city) where.city = params.city;
  if (params.city && params.district) where.district = params.district;
  if (params.rooms && ROOM_VALUES.has(params.rooms)) {
    where.rooms = params.rooms === "4" ? { gte: 4 } : Number(params.rooms);
  }

  const gte = priceBound(params.priceMin);
  const lte = priceBound(params.priceMax);
  if (gte !== undefined || lte !== undefined) {
    where.price = {
      ...(gte !== undefined ? { gte } : {}),
      ...(lte !== undefined ? { lte } : {}),
    };
  }

  return where;
}
