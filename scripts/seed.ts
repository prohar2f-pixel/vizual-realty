import "dotenv/config";
import { db } from "../src/lib/db";

const agents = [
  { id: "a1", name: "Ольга Петрова", phone: "79991112233", photoUrl: "https://i.pravatar.cc/200?img=47" },
  { id: "a2", name: "Сергей Иванов", phone: "79994445566", photoUrl: "https://i.pravatar.cc/200?img=12" },
];

const props = [
  {
    id: "1001", shortId: 1001, deal: "sale", objectType: "flat",
    title: "2-комн. квартира, ул. Артёма, 15", price: 4500000, rooms: 2, area: 54.3,
    district: "Центр", address: "ул. Артёма, 15", description: "Светлая квартира с качественным ремонтом, рядом школа и парк.",
    photos: ["https://picsum.photos/seed/v1a/800/600", "https://picsum.photos/seed/v1b/800/600"],
    isFeed: true, agentId: "a1",
  },
  {
    id: "1002", shortId: 1002, deal: "sale", objectType: "flat",
    title: "1-комн. квартира, ул. Мира, 7", price: 3100000, rooms: 1, area: 38.0,
    district: "Центр", address: "ул. Мира, 7", description: "Уютная студия после ремонта, готова к заселению.",
    photos: ["https://picsum.photos/seed/v2a/800/600", "https://picsum.photos/seed/v2b/800/600"],
    isFeed: true, agentId: "a2",
  },
  {
    id: "1003", shortId: 1003, deal: "sale", objectType: "house",
    title: "Дом 120 м², пос. Солнечный", price: 8900000, rooms: 4, area: 120.0,
    district: "Солнечный", address: "пос. Солнечный, ул. Садовая, 3", description: "Просторный дом с участком 6 соток, гараж, баня.",
    photos: ["https://picsum.photos/seed/v3a/800/600", "https://picsum.photos/seed/v3b/800/600"],
    isFeed: true, agentId: "a1",
  },
  {
    id: "1004", shortId: 1004, deal: "sale", objectType: "flat",
    title: "3-комн. квартира, пр. Победы, 42", price: 6200000, rooms: 3, area: 76.5,
    district: "Победа", address: "пр. Победы, 42", description: "Большая квартира с панорамными окнами и двумя балконами.",
    photos: ["https://picsum.photos/seed/v4a/800/600", "https://picsum.photos/seed/v4b/800/600"],
    isFeed: true, agentId: "a2",
  },
  {
    id: "1005", shortId: 1005, deal: "sale", objectType: "flat",
    title: "Студия, ул. Лесная, 9", price: 2450000, rooms: 1, area: 28.0,
    district: "Лесной", address: "ул. Лесная, 9", description: "Компактная студия для старта или под аренду.",
    photos: ["https://picsum.photos/seed/v5a/800/600", "https://picsum.photos/seed/v5b/800/600"],
    isFeed: true, agentId: "a1",
  },
  {
    id: "1006", shortId: 1006, deal: "sale", objectType: "house",
    title: "Коттедж 200 м², Солнечный", price: 14500000, rooms: 5, area: 200.0,
    district: "Солнечный", address: "пос. Солнечный, ул. Озёрная, 12", description: "Современный коттедж премиум-класса с видом на озеро.",
    photos: ["https://picsum.photos/seed/v6a/800/600", "https://picsum.photos/seed/v6b/800/600"],
    isFeed: true, agentId: "a2",
  },
];

async function main() {
  for (const a of agents) {
    await db.agent.upsert({ where: { id: a.id }, update: a, create: a });
  }
  for (const p of props) {
    await db.property.upsert({ where: { id: p.id }, update: p, create: p });
  }
  console.log(`seeded ${agents.length} agents, ${props.length} properties`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
