import "dotenv/config";

import { db } from "../src/lib/db";
import { getEntities, getIds } from "../src/lib/topnlab/client";
import { resolveTopnlabManager } from "../src/lib/topnlab/manager";

async function syncManagers() {
  const ids = [...(await getIds("sale")), ...(await getIds("rent"))];
  const entities = await getEntities(ids);
  let updated = 0;

  for (const entity of entities) {
    const manager = resolveTopnlabManager(entity);
    if (!manager) continue;

    const propertyId = String(entity.id);
    const property = await db.property.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!property) continue;

    await db.agent.upsert({
      where: { id: manager.id },
      update: { name: manager.name, phone: manager.phone, photoUrl: manager.photo },
      create: { id: manager.id, name: manager.name, phone: manager.phone, photoUrl: manager.photo },
    });
    await db.property.update({ where: { id: propertyId }, data: { agentId: manager.id } });
    updated++;
  }

  console.log(`updated manager links: ${updated}`);
}

syncManagers().finally(() => db.$disconnect());
