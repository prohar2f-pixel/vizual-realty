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

// Единственное место правки названий полей. Когда придёт реальный ответ
// get-entities (нужен API-ключ), сверить поля и при необходимости поправить здесь.
export function mapTopnlabEntity(e: any): MappedProperty {
  return {
    id: String(e.id),
    shortId: e.short_id ?? undefined,
    deal: e.deal,
    objectType: e.object_type,
    title: e.title,
    price: Number(e.price),
    rooms: e.rooms ?? undefined,
    area: e.area ?? undefined,
    district: e.district ?? undefined,
    address: e.address ?? undefined,
    description: e.description ?? undefined,
    photos: Array.isArray(e.photos) ? e.photos : [],
    isFeed: e.is_feed !== false,
    agent: e.agent
      ? { id: String(e.agent.id), name: e.agent.name, phone: e.agent.phone, photoUrl: e.agent.photo }
      : undefined,
  };
}
