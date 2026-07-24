import {
  extractTopnlabDistrict,
  formatTopnlabAddress,
  normalizePropertyDescription,
} from "../property-content";

export type MappedAgent = { id: string; name: string; phone?: string; photoUrl?: string };

export type MappedProperty = {
  id: string;
  shortId?: number;
  deal: string;
  objectType: string;
  title: string;
  price: number;
  rooms?: number;
  area?: number;
  district?: string;
  address?: string;
  description?: string;
  photos: string[];
  isFeed: boolean;
  agent?: MappedAgent;
};

const OBJECT_TYPE_TITLES: Record<string, string> = {
  flat: "квартира",
  apartment: "апартаменты",
  room: "комната",
  house: "дом",
  cottage: "коттедж",
  townhouse: "таунхаус",
  land: "земельный участок",
  commercial: "коммерческая недвижимость",
};

function buildPropertyTitle(
  entity: Record<string, any>,
  objectType: string,
  address?: string,
): string {
  const explicitTitle =
    typeof entity.title === "string" ? entity.title.trim() : "";
  if (explicitTitle) return explicitTitle;

  const typeTitle = OBJECT_TYPE_TITLES[objectType] ?? "объект недвижимости";
  const roomPrefix =
    objectType === "flat" && Number.isFinite(Number(entity.rooms))
      ? `${Number(entity.rooms)}-комн. `
      : "";
  const subject = `${roomPrefix}${typeTitle}`;
  const capitalized = subject.charAt(0).toLocaleUpperCase("ru") + subject.slice(1);

  return address ? `${capitalized}, ${address}` : capitalized;
}

// Единственное место правки названий полей. Когда придёт реальный ответ
// get-entities (нужен API-ключ), сверить поля и при необходимости поправить здесь.
export function mapTopnlabEntity(e: any): MappedProperty {
  const objectType = e.object_type ?? e.realty_type;
  const address = formatTopnlabAddress(e) ?? undefined;

  return {
    id: String(e.id),
    shortId: e.short_id ?? undefined,
    deal: e.deal,
    objectType,
    title: buildPropertyTitle(e, objectType, address),
    price: Number(e.price),
    rooms: e.rooms ?? undefined,
    area: e.area ?? undefined,
    district: extractTopnlabDistrict(e),
    address,
    description: normalizePropertyDescription(e.description),
    photos: Array.isArray(e.photos) ? e.photos : [],
    isFeed: e.is_feed !== false,
    agent: e.agent
      ? { id: String(e.agent.id), name: e.agent.name, phone: e.agent.phone, photoUrl: e.agent.photo }
      : undefined,
  };
}
