import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import {
  DEFAULT_SITE_CONTENT,
  type SiteContentV1,
} from "../src/lib/site-content/defaults";

const SITE_CONTENT_ID = "site";

function toJson(value: SiteContentV1): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function seedAdminContent(): Promise<void> {
  const now = new Date();
  const content = toJson(DEFAULT_SITE_CONTENT);

  await db.siteContent.upsert({
    where: { id: SITE_CONTENT_ID },
    update: {},
    create: {
      id: SITE_CONTENT_ID,
      draft: content,
      published: content,
      draftUpdatedAt: now,
      publishedAt: now,
    },
  });

  const featuredCount = await db.featuredProperty.count();
  if (featuredCount !== 0) {
    return;
  }

  const properties = await db.property.findMany({
    where: { isFeed: true },
    orderBy: { price: "desc" },
    take: 3,
    select: { id: true },
  });

  if (properties.length > 0) {
    await db.featuredProperty.createMany({
      data: properties.map((property, index) => ({
        propertyId: property.id,
        position: index + 1,
      })),
    });
  }
}

if (process.argv[1]?.endsWith("seed-admin-content.ts")) {
  seedAdminContent()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
