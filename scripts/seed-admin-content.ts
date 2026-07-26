import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import {
  DEFAULT_SITE_CONTENT,
  type SiteContentV1,
} from "../src/lib/site-content/defaults";
import { withSiteContentMutationLock } from "../src/lib/site-content/mutation-lock";

const SITE_CONTENT_ID = "site";

type SeedAdminContentClient = {
  $transaction<T>(
    run: (transaction: unknown) => Promise<T>,
  ): Promise<T>;
};

type SeedAdminContentTransaction = {
  siteContent: {
    findUnique(args: {
      where: { id: string };
      select: { id: true };
    }): Promise<unknown>;
    create(args: {
      data: {
        id: string;
        draft: Prisma.InputJsonValue;
        published: Prisma.InputJsonValue;
        draftUpdatedAt: Date;
        publishedAt: Date;
      };
    }): Promise<unknown>;
  };
  featuredProperty: {
    deleteMany(): Promise<unknown>;
    createMany(args: {
      data: Array<{ propertyId: string; position: 1 | 2 | 3 }>;
    }): Promise<unknown>;
  };
  property: {
    findMany(args: {
      where: { isFeed: true };
      orderBy: { price: "desc" };
      take: 3;
      select: { id: true };
    }): Promise<Array<{ id: string }>>;
  };
};

function toJson(value: SiteContentV1): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function seedAdminContentWith(
  client: SeedAdminContentClient,
): Promise<void> {
  const now = new Date();
  const content = toJson(DEFAULT_SITE_CONTENT);

  await withSiteContentMutationLock(client, async (rawTransaction) => {
    const transaction = rawTransaction as SeedAdminContentTransaction;
    const existing = await transaction.siteContent.findUnique({
      where: { id: SITE_CONTENT_ID },
      select: { id: true },
    });
    if (existing) return;

    const properties = await transaction.property.findMany({
      where: { isFeed: true },
      orderBy: { price: "desc" },
      take: 3,
      select: { id: true },
    });

    await transaction.featuredProperty.deleteMany();
    await transaction.siteContent.create({
      data: {
        id: SITE_CONTENT_ID,
        draft: content,
        published: content,
        draftUpdatedAt: now,
        publishedAt: now,
      },
    });

    if (properties.length > 0) {
      await transaction.featuredProperty.createMany({
        data: properties.map((property, index) => ({
          propertyId: property.id,
          position: (index + 1) as 1 | 2 | 3,
        })),
      });
    }
  });
}

export async function seedAdminContent(): Promise<void> {
  await seedAdminContentWith(db);
}

if (process.argv[1]?.endsWith("seed-admin-content.ts")) {
  seedAdminContent()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
