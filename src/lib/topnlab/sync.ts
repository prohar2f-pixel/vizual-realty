import { db } from "../db";
import { getIds, getEntities } from "./client";
import { mapTopnlabEntity, MappedProperty } from "./map";

export async function upsertProperty(p: MappedProperty) {
  if (p.agent) {
    await db.agent.upsert({
      where: { id: p.agent.id },
      update: { name: p.agent.name, phone: p.agent.phone, photoUrl: p.agent.photoUrl },
      create: { id: p.agent.id, name: p.agent.name, phone: p.agent.phone, photoUrl: p.agent.photoUrl },
    });
  }
  const { agent, ...data } = p;
  await db.property.upsert({
    where: { id: p.id },
    update: { ...data, agentId: agent?.id ?? null },
    create: { ...data, agentId: agent?.id ?? null },
  });
}

export async function fullSync() {
  const ids = [...(await getIds("sale")), ...(await getIds("rent"))];
  const entities = await getEntities(ids);
  for (const e of entities) await upsertProperty(mapTopnlabEntity(e));
  return entities.length;
}
