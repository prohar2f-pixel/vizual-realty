import { expect, test } from "vitest";
import { seedAdminContentWith } from "../scripts/seed-admin-content";

type StoredContent = {
  id: string;
  draft: unknown;
  published: unknown;
  draftUpdatedAt: Date;
  publishedAt: Date;
};

type Featured = { propertyId: string; position: number };

function createInMemorySeedClient(options: {
  content?: StoredContent;
  featured?: Featured[];
  properties?: Array<{ id: string }>;
}) {
  const state = {
    content: options.content,
    featured: [...(options.featured ?? [])],
    properties: [...(options.properties ?? [])],
  };

  return {
    state,
    client: {
      siteContent: {
        async upsert({ create }: { create: StoredContent }) {
          if (!state.content) {
            state.content = create;
          }
          return state.content;
        },
      },
      featuredProperty: {
        async count() {
          return state.featured.length;
        },
        async createMany({ data }: { data: Featured[] }) {
          state.featured.push(...data);
        },
      },
      property: {
        async findMany() {
          return state.properties;
        },
      },
    },
  };
}

test("keeps existing draft and published snapshots unchanged", async () => {
  const original = {
    id: "site",
    draft: { title: "Черновик клиента" },
    published: { title: "Опубликовано клиентом" },
    draftUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
    publishedAt: new Date("2026-01-02T00:00:00.000Z"),
  };
  const { client, state } = createInMemorySeedClient({ content: original });

  await seedAdminContentWith(client);

  expect(state.content?.draft).toEqual(original.draft);
  expect(state.content?.published).toEqual(original.published);
});

test("adds initial featured properties only when the table is empty", async () => {
  const existing = { propertyId: "already-featured", position: 1 };
  const { client, state } = createInMemorySeedClient({
    featured: [existing],
    properties: [{ id: "candidate" }],
  });

  await seedAdminContentWith(client);

  expect(state.featured).toEqual([existing]);
});

test("numbers an empty initial featured selection from one through three", async () => {
  const { client, state } = createInMemorySeedClient({
    properties: [{ id: "most-expensive" }, { id: "second" }, { id: "third" }],
  });

  await seedAdminContentWith(client);

  expect(state.featured).toEqual([
    { propertyId: "most-expensive", position: 1 },
    { propertyId: "second", position: 2 },
    { propertyId: "third", position: 3 },
  ]);
});
