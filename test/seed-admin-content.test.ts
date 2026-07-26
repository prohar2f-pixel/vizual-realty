import { expect, test } from "vitest";
import { seedAdminContentWith } from "../scripts/seed-admin-content";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";

type StoredContent = {
  id: string;
  draft: unknown;
  published: unknown;
  draftUpdatedAt: Date;
  publishedAt: Date;
};

type Featured = { propertyId: string; position: number };

type SeedState = {
  content?: StoredContent;
  featured: Featured[];
  properties: Array<{ id: string }>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createInMemorySeedClient(options: {
  content?: StoredContent;
  featured?: Featured[];
  properties?: Array<{ id: string }>;
  failFeaturedCreate?: boolean;
}) {
  const state: SeedState = {
    content: options.content === undefined ? undefined : clone(options.content),
    featured: clone(options.featured ?? []),
    properties: clone(options.properties ?? []),
  };
  const operations: string[] = [];

  function api(target: SeedState, prefix: string) {
    return {
      siteContent: {
        async findUnique() {
          operations.push(`${prefix}siteContent.findUnique`);
          return target.content ? { id: target.content.id } : null;
        },
        async create({ data }: { data: StoredContent }) {
          operations.push(`${prefix}siteContent.create`);
          if (target.content) throw new Error("site-content-already-exists");
          target.content = clone(data);
          return clone(data);
        },
      },
      featuredProperty: {
        async deleteMany() {
          operations.push(`${prefix}featuredProperty.deleteMany`);
          const count = target.featured.length;
          target.featured = [];
          return { count };
        },
        async createMany({ data }: { data: Featured[] }) {
          operations.push(`${prefix}featuredProperty.createMany`);
          if (options.failFeaturedCreate) {
            throw new Error("featured-create-failed");
          }
          target.featured.push(...clone(data));
          return { count: data.length };
        },
      },
      property: {
        async findMany() {
          operations.push(`${prefix}property.findMany`);
          return clone(target.properties);
        },
      },
      async $queryRaw<T>(): Promise<T> {
        operations.push(`${prefix}advisoryLock`);
        return [] as T;
      },
    };
  }

  const root = api(state, "");
  const client = {
    ...root,
    async $transaction<T>(run: (transaction: unknown) => Promise<T>) {
      operations.push("$transaction");
      const working = clone(state);
      const result = await run(api(working, "tx."));
      state.content = working.content;
      state.featured = working.featured;
      state.properties = working.properties;
      return result;
    },
  };

  return { state, client, operations };
}

test("an existing SiteContent row keeps an intentionally empty featured selection", async () => {
  const original: StoredContent = {
    id: "site",
    draft: { title: "Client draft" },
    published: { title: "Client publication" },
    draftUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
    publishedAt: new Date("2026-01-02T00:00:00.000Z"),
  };
  const { client, state, operations } = createInMemorySeedClient({
    content: original,
    properties: [{ id: "candidate" }],
  });

  await seedAdminContentWith(client);

  expect(state.content).toEqual(original);
  expect(state.featured).toEqual([]);
  expect(operations).toEqual([
    "$transaction",
    "tx.advisoryLock",
    "tx.siteContent.findUnique",
  ]);
});

test("first initialization creates content and replaces partial featured state atomically", async () => {
  const { client, state, operations } = createInMemorySeedClient({
    featured: [{ propertyId: "migration-stale", position: 1 }],
    properties: [
      { id: "most-expensive" },
      { id: "second" },
      { id: "third" },
    ],
  });

  await seedAdminContentWith(client);

  expect(state.content).toMatchObject({
    id: "site",
    draft: DEFAULT_SITE_CONTENT,
    published: DEFAULT_SITE_CONTENT,
  });
  expect(state.featured).toEqual([
    { propertyId: "most-expensive", position: 1 },
    { propertyId: "second", position: 2 },
    { propertyId: "third", position: 3 },
  ]);
  expect(operations).toEqual([
    "$transaction",
    "tx.advisoryLock",
    "tx.siteContent.findUnique",
    "tx.property.findMany",
    "tx.featuredProperty.deleteMany",
    "tx.siteContent.create",
    "tx.featuredProperty.createMany",
  ]);
});

test("a featured write failure rolls back content and featured initialization", async () => {
  const { client, state } = createInMemorySeedClient({
    properties: [{ id: "candidate" }],
    failFeaturedCreate: true,
  });

  await expect(seedAdminContentWith(client)).rejects.toThrow(
    "featured-create-failed",
  );

  expect(state.content).toBeUndefined();
  expect(state.featured).toEqual([]);
});

test("repeat seeding does not overwrite content or refill a cleared selection", async () => {
  const { client, state, operations } = createInMemorySeedClient({
    properties: [{ id: "candidate" }],
  });
  await seedAdminContentWith(client);
  if (!state.content) throw new Error("expected initialized content");
  state.content.draft = { title: "Edited draft" };
  state.content.published = { title: "Edited publication" };
  state.featured = [];
  operations.length = 0;

  await seedAdminContentWith(client);

  expect(state.content.draft).toEqual({ title: "Edited draft" });
  expect(state.content.published).toEqual({ title: "Edited publication" });
  expect(state.featured).toEqual([]);
  expect(operations).toEqual([
    "$transaction",
    "tx.advisoryLock",
    "tx.siteContent.findUnique",
  ]);
});
