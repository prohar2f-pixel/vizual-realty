import { db } from "../db";
import {
  formatTopnlabAddress,
  normalizePropertyDescription,
} from "../property-content";
import { getEntities, getIds } from "./client";

export function propertyContentUpdate(entity: Record<string, unknown>) {
  const address = formatTopnlabAddress(entity);
  const description = normalizePropertyDescription(
    typeof entity.description === "string" ? entity.description : undefined,
  );

  return {
    ...(address ? { address } : {}),
    ...(description ? { description } : {}),
  };
}

export async function syncPropertyContent() {
  const ids = [...new Set([...(await getIds("sale")), ...(await getIds("rent"))])];
  const entities = await getEntities(ids);
  const existing = new Set(
    (
      await db.property.findMany({
        where: { id: { in: entities.map((entity) => String(entity.id)) } },
        select: { id: true },
      })
    ).map(({ id }) => id),
  );

  let updated = 0;
  let skipped = 0;

  for (const entity of entities) {
    const id = String(entity.id);
    if (!existing.has(id)) {
      skipped += 1;
      continue;
    }

    const data = propertyContentUpdate(entity);
    if (Object.keys(data).length === 0) {
      skipped += 1;
      continue;
    }

    await db.property.update({ where: { id }, data });
    updated += 1;
  }

  return { updated, skipped };
}
