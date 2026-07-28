import {
  extractTopnlabCity,
  extractTopnlabDistrict,
  formatTopnlabAddress,
  normalizePropertyDescription,
} from "../property-content";
import { resolveTopnlabManager } from "./manager";

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
  floor?: number;
  floors?: number;
  city?: string;
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
  rooms: number | undefined,
  address?: string,
): string {
  const explicitTitle =
    typeof entity.title === "string"
      ? entity.title.trim()
      : typeof entity.display_title === "string"
        ? entity.display_title.trim()
        : "";
  if (explicitTitle) return explicitTitle;

  const typeTitle = OBJECT_TYPE_TITLES[objectType] ?? "объект недвижимости";
  const roomPrefix =
    objectType === "flat" && rooms != null
      ? `${rooms}-комн. `
      : "";
  const subject = `${roomPrefix}${typeTitle}`;
  const capitalized = subject.charAt(0).toLocaleUpperCase("ru") + subject.slice(1);

  return address ? `${capitalized}, ${address}` : capitalized;
}

function normalizeRooms(value: unknown): number | undefined {
  const rooms = Number(value);
  if (!Number.isFinite(rooms)) return undefined;
  return rooms >= 20 && rooms % 10 === 0 ? rooms / 10 - 1 : rooms;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function mapPhotoUrls(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];

  return photos.flatMap((photo) => {
    if (typeof photo === "string" && photo.trim()) return [photo.trim()];
    if (!photo || typeof photo !== "object") return [];

    const value = photo as Record<string, unknown>;
    const url = [
      value.large_hash,
      value.original,
      value.original_hash,
      value.medium_hash,
      value.small_hash,
      value.url,
    ].find((candidate) => typeof candidate === "string" && candidate.trim());

    return typeof url === "string" ? [url.trim()] : [];
  });
}

// Единственное место правки названий полей. Когда придёт реальный ответ
// get-entities (нужен API-ключ), сверить поля и при необходимости поправить здесь.
export function mapTopnlabEntity(e: any): MappedProperty {
  const objectType = e.object_type ?? e.realty_type;
  const address = formatTopnlabAddress(e) ?? undefined;
  const rooms = normalizeRooms(e.rooms);
  const managerSource = e.user ?? e.agent;
  const managerProfile = resolveTopnlabManager(e);
  const managerId =
    e.created_by ?? e.user_id ?? e.agent_id ?? managerSource?.id ?? managerProfile?.id;
  const manager =
    managerId == null ||
    (typeof managerSource?.name !== "string" && !managerProfile)
      ? undefined
      : {
          id: String(managerId),
          name:
            typeof managerSource?.name === "string"
              ? managerSource.name
              : managerProfile!.name,
          phone:
            typeof managerSource?.phone === "string"
              ? managerSource.phone
              : managerProfile?.phone,
          photoUrl:
            typeof managerSource?.photo === "string"
              ? managerSource.photo
              : managerProfile?.photo,
        };

  return {
    id: String(e.id),
    shortId: e.short_id ?? undefined,
    deal: e.deal ?? e.deal_type ?? e.operation_type ?? "sale",
    objectType,
    title: buildPropertyTitle(e, objectType, rooms, address),
    price: Number(e.price),
    rooms,
    area: e.area ?? undefined,
    floor: normalizePositiveInteger(e.floor),
    floors: normalizePositiveInteger(e.floors),
    city: extractTopnlabCity(e),
    district: extractTopnlabDistrict(e),
    address,
    description: normalizePropertyDescription(e.description),
    photos: mapPhotoUrls(e.photos),
    isFeed: e.is_feed !== false,
    agent: manager,
  };
}
