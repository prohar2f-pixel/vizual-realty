import { hashIds, normalizeIds, type Fetcher, type SourceConfig, type SourceResult } from "./types";

function idsUrl(config: Pick<SourceConfig, "apiBaseUrl" | "apiKey">, inAdvertising: boolean): string {
  const url = new URL("/public/get-ids", config.apiBaseUrl);
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("type", "realty");
  url.searchParams.set("action", "sale");
  if (inAdvertising) url.searchParams.set("in_ad", "true");
  return url.toString();
}

function entitiesUrl(config: Pick<SourceConfig, "apiBaseUrl" | "apiKey">, ids: string[]): string {
  const url = new URL("/public/get-entities", config.apiBaseUrl);
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("type", "realty");
  url.searchParams.set("id", ids.join(","));
  return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  return values.map(nonEmptyString).find(Boolean);
}

function positiveNumber(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number > 0 ? number : undefined;
}

function diagnosticFields(entity: Record<string, unknown>): Record<string, unknown> {
  const user = asRecord(entity.user) ?? asRecord(entity.agent);
  const address = asRecord(entity.address);
  const photos = Array.isArray(entity.photos) ? entity.photos : [];
  const price = positiveNumber(entity.price);
  const floor = finiteNumber(entity.floor);
  const floors = finiteNumber(entity.floors);
  return {
    agentName: nonEmptyString(user?.name),
    cityName: firstString(entity.city_name, address?.city_name, entity.locality, entity.city),
    districtName: firstString(entity.city_district_name, entity.district_name, entity.district),
    hasAddress: Boolean(firstString(entity.short_address, entity.full_address, entity.address_full, entity.street_name, entity.street, typeof entity.address === "string" ? entity.address : undefined)),
    hasDescription: Boolean(firstString(entity.mydescription, entity.note_public, entity.description)),
    hasPrice: price !== undefined,
    realtyType: firstString(entity.realty_type, entity.property_type, entity.object_type),
    dealState: nonEmptyString(entity.deal_state),
    inAd: entity.in_ad === true || entity.in_ad === 1 || entity.in_ad === "1" || entity.in_ad === "true",
    area: positiveNumber(entity.area_common),
    landArea: positiveNumber(entity.area_land),
    rooms: positiveNumber(entity.rooms),
    floor,
    floors,
    photoCount: photos.length,
  };
}

function normalizeEntities(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
  const record = asRecord(payload);
  if (!record) throw new Error("TOPNLAB_ENTITIES_SHAPE");
  return Object.values(record).map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
}

export async function readTopnlabApi(
  config: Pick<SourceConfig, "apiBaseUrl" | "apiKey">,
  fetcher: Fetcher = fetch,
): Promise<SourceResult> {
  const startedAt = new Date();
  const response = await fetcher(idsUrl(config, true), { method: "GET" });
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

export async function readTopnlabAll(
  config: Pick<SourceConfig, "apiBaseUrl" | "apiKey">,
  fetcher: Fetcher = fetch,
): Promise<SourceResult> {
  const startedAt = new Date();
  const response = await fetcher(idsUrl(config, false), { method: "GET" });
  if (!response.ok) throw new Error(`TOPNLAB_ALL_IDS_HTTP_${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("TOPNLAB_ALL_IDS_SHAPE");
  const ids = normalizeIds(payload);
  if (ids.length === 0) throw new Error("TOPNLAB_ALL_IDS_EMPTY");
  return { source: "api_all", ids, rawEntities: new Map(), startedAt, finishedAt: new Date(), idsSha256: hashIds(ids) };
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function readTopnlabEntities(
  config: Pick<SourceConfig, "apiBaseUrl" | "apiKey">,
  requestedIds: string[],
  fetcher: Fetcher = fetch,
  waiter: (milliseconds: number) => Promise<void> = wait,
): Promise<SourceResult> {
  const startedAt = new Date();
  const ids = normalizeIds(requestedIds);
  const rawEntities = new Map<string, Record<string, unknown>>();
  for (let offset = 0; offset < ids.length; offset += 300) {
    if (offset > 0) await waiter(6000);
    const batch = ids.slice(offset, offset + 300);
    const response = await fetcher(entitiesUrl(config, batch), { method: "GET" });
    if (!response.ok) throw new Error(`TOPNLAB_ENTITIES_HTTP_${response.status}`);
    for (const entity of normalizeEntities(await response.json())) {
      const id = String(entity.id ?? "").trim();
      if (id && ids.includes(id)) rawEntities.set(id, diagnosticFields(entity));
    }
  }
  if (rawEntities.size !== ids.length) throw new Error("TOPNLAB_ENTITIES_INCOMPLETE");
  return { source: "api", ids, rawEntities, startedAt, finishedAt: new Date(), idsSha256: hashIds(ids) };
}

export async function readTopnlabInventory(
  config: Pick<SourceConfig, "apiBaseUrl" | "apiKey">,
  fetcher: Fetcher = fetch,
  waiter: (milliseconds: number) => Promise<void> = wait,
): Promise<{ all: SourceResult; advertised: SourceResult }> {
  let requested = false;
  const limitedFetcher: Fetcher = async (input, init) => {
    if (requested) await waiter(6000);
    requested = true;
    return fetcher(input, init);
  };
  const all = await readTopnlabAll(config, limitedFetcher);
  const advertised = await readTopnlabApi(config, limitedFetcher);
  const diagnostics = await readTopnlabEntities(config, all.ids, limitedFetcher, async () => undefined);
  return {
    all: { ...all, rawEntities: diagnostics.rawEntities, finishedAt: diagnostics.finishedAt },
    advertised,
  };
}
