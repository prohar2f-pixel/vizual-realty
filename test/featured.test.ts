import { describe, expect, test, vi } from "vitest";
import {
  FeaturedValidationError,
  getAdminFeaturedProperties,
  getFeaturedProperties,
  replaceFeaturedPropertyIds,
  searchPublicProperties,
} from "../src/lib/featured";
import { createFeaturedHandlers } from "../src/app/api/admin/featured/route";
import { createPropertySearchHandler } from "../src/app/api/admin/properties/route";

type PropertyFixture = {
  id: string;
  shortId: number | null;
  title: string;
  price: number;
  rooms: number | null;
  area: number | null;
  city: string | null;
  district: string | null;
  address: string | null;
  photos: string[];
  isFeed: boolean;
};

function property(
  id: string,
  overrides: Partial<PropertyFixture> = {},
): PropertyFixture {
  return {
    id,
    shortId: null,
    title: `Объект ${id}`,
    price: 5_000_000,
    rooms: 2,
    area: 54,
    city: "Донецк",
    district: "Калининский",
    address: `ул. Тестовая, ${id}`,
    photos: [`https://img.test/${id}/one.jpg`, `https://img.test/${id}/two.jpg`],
    isFeed: true,
    ...overrides,
  };
}

class InMemoryFeaturedClient {
  readonly properties: PropertyFixture[];
  featured: Array<{ propertyId: string; position: number }>;
  transactionCalls = 0;
  private latestSearchIds: string[] = [];

  constructor(
    properties: PropertyFixture[],
    featured: Array<{ propertyId: string; position: number }> = [],
  ) {
    this.properties = properties;
    this.featured = featured;
  }

  property = {
    findMany: async () => [],
    count: async () => 0,
  } as {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
    count(args: Record<string, unknown>): Promise<number>;
  };

  featuredProperty = {
    findMany: async () => [],
    deleteMany: async () => ({ count: 0 }),
    createMany: async () => ({ count: 0 }),
  } as {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
    deleteMany(): Promise<{ count: number }>;
    createMany(args: { data: Array<{ propertyId: string; position: number }> }): Promise<{ count: number }>;
  };

  async $queryRaw<T>(): Promise<T> {
    return this.latestSearchIds
      .map((id) => {
        const row = this.properties.find((item) => item.id === id);
        return row ? { id, photo: row.photos[0] ?? null } : null;
      })
      .filter(Boolean) as T;
  }

  async $transaction<T>(run: (tx: InMemoryFeaturedClient) => Promise<T>) {
    this.transactionCalls += 1;
    return run(this);
  }

  initialize() {
    this.property.findMany = async (args) => {
      const where = args.where as {
        id?: { in?: string[] };
        isFeed?: boolean;
        OR?: Array<Record<string, unknown>>;
      };
      let rows = this.properties.filter(
        (item) => where.isFeed === undefined || item.isFeed === where.isFeed,
      );
      if (where.id?.in) {
        rows = rows.filter((item) => where.id?.in?.includes(item.id));
      }
      if (where.OR) {
        rows = rows.filter((item) =>
          where.OR?.some((condition) => {
            if (typeof condition.id === "string") return item.id === condition.id;
            if (typeof condition.shortId === "number") {
              return item.shortId === condition.shortId;
            }
            for (const field of ["title", "address", "city"] as const) {
              const filter = condition[field] as { contains?: string } | undefined;
              if (
                filter?.contains !== undefined &&
                item[field]?.toLocaleLowerCase("ru").includes(
                  filter.contains.toLocaleLowerCase("ru"),
                )
              ) {
                return true;
              }
            }
            return false;
          }),
        );
      }
      const skip = Number(args.skip ?? 0);
      const take = Number(args.take ?? rows.length);
      rows = rows.slice(skip, skip + take);
      this.latestSearchIds = rows.map((item) => item.id);
      return rows.map((item) => ({
        id: item.id,
        shortId: item.shortId,
        title: item.title,
        price: item.price,
        rooms: item.rooms,
        area: item.area,
        city: item.city,
        district: item.district,
        address: item.address,
        isFeed: item.isFeed,
      }));
    };
    this.property.count = async (args) => {
      const rows = await this.property.findMany(args);
      return rows.length;
    };
    this.featuredProperty.findMany = async (args) => {
      const propertyMustBePublic = Boolean(
        ((args.where as { property?: { isFeed?: boolean } } | undefined)?.property)
          ?.isFeed,
      );
      return [...this.featured]
        .sort((left, right) => left.position - right.position)
        .map((selection) => ({
          ...selection,
          property: this.properties.find(
            (item) =>
              item.id === selection.propertyId &&
              (!propertyMustBePublic || item.isFeed),
          ),
        }))
        .filter((selection) => selection.property);
    };
    this.featuredProperty.deleteMany = async () => {
      const count = this.featured.length;
      this.featured = [];
      return { count };
    };
    this.featuredProperty.createMany = async ({ data }) => {
      this.featured = data.map((item) => ({ ...item }));
      return { count: data.length };
    };
    return this;
  }
}

function client(
  properties: PropertyFixture[],
  featured: Array<{ propertyId: string; position: number }> = [],
) {
  return new InMemoryFeaturedClient(properties, featured).initialize();
}

describe("featured property replacement", () => {
  test.each([
    [[], "INVALID_COUNT"],
    [["a", "b", "c", "d"], "INVALID_COUNT"],
    [["a", "a"], "DUPLICATE_IDS"],
  ])("rejects invalid ID collections before database work", async (ids, code) => {
    const database = client([property("a"), property("b"), property("c")]);

    await expect(
      replaceFeaturedPropertyIds(ids, database),
    ).rejects.toMatchObject({ code });
    expect(database.transactionCalls).toBe(0);
  });

  test.each([["missing"], ["hidden"]])(
    "rejects missing or hidden property %s before replacement",
    async (id) => {
      const database = client(
        [property("old"), property("hidden", { isFeed: false })],
        [{ propertyId: "old", position: 1 }],
      );

      await expect(
        replaceFeaturedPropertyIds([id], database),
      ).rejects.toMatchObject({
        code: "PROPERTY_NOT_PUBLIC",
      });
      expect(database.featured).toEqual([{ propertyId: "old", position: 1 }]);
      expect(database.transactionCalls).toBe(0);
    },
  );

  test.each([
    [["a"], [{ propertyId: "a", position: 1 }]],
    [
      ["c", "a", "b"],
      [
        { propertyId: "c", position: 1 },
        { propertyId: "a", position: 2 },
        { propertyId: "b", position: 3 },
      ],
    ],
  ])("replaces one to three IDs in one transaction", async (ids, expected) => {
    const database = client(
      [property("a"), property("b"), property("c"), property("old")],
      [{ propertyId: "old", position: 1 }],
    );

    await replaceFeaturedPropertyIds(ids, database);

    expect(database.transactionCalls).toBe(1);
    expect(database.featured).toEqual(expected);
  });
});

describe("featured property reads", () => {
  test("returns public cards in saved order and only the first photo", async () => {
    const database = client(
      [property("a"), property("b")],
      [
        { propertyId: "a", position: 2 },
        { propertyId: "b", position: 1 },
      ],
    );

    const items = await getFeaturedProperties(database);

    expect(items.map((item) => item.id)).toEqual(["b", "a"]);
    expect(items[0].photo).toBe("https://img.test/b/one.jpg");
    expect(items[0]).not.toHaveProperty("photos");
  });

  test("skips a saved property hidden after selection but exposes it to admin", async () => {
    const database = client(
      [property("visible"), property("hidden", { isFeed: false })],
      [
        { propertyId: "visible", position: 1 },
        { propertyId: "hidden", position: 2 },
      ],
    );

    await expect(getFeaturedProperties(database)).resolves.toMatchObject([
      { id: "visible" },
    ]);
    await expect(getAdminFeaturedProperties(database)).resolves.toMatchObject([
      { id: "visible", isFeed: true },
      { id: "hidden", isFeed: false },
    ]);
  });
});

describe("bounded public property search", () => {
  test.each([
    ["item-id", ["item-id"]],
    ["314", ["short-id"]],
    ["СОЛНЕЧНАЯ", ["title"]],
    ["бережная", ["address"]],
    ["макеевка", ["city"]],
  ])("searches public cards by %s", async (query, expectedIds) => {
    const database = client([
      property("item-id"),
      property("short-id", { shortId: 314 }),
      property("title", { title: "Солнечная квартира" }),
      property("address", { address: "Набережная улица" }),
      property("city", { city: "Макеевка" }),
      property("hidden", { title: "Солнечная скрытая", isFeed: false }),
    ]);

    const result = await searchPublicProperties(
      { query, page: 1, pageSize: 20 },
      database,
    );

    expect(result.items.map((item) => item.id)).toEqual(expectedIds);
    expect(result).toMatchObject({ total: expectedIds.length, page: 1, pageSize: 20 });
    expect(result.items[0]).not.toHaveProperty("photos");
  });

  test("paginates a bounded result and rejects unsafe input", async () => {
    const database = client(
      Array.from({ length: 25 }, (_, index) => property(`p-${index + 1}`)),
    );

    const result = await searchPublicProperties(
      { query: "", page: 2, pageSize: 20 },
      database,
    );

    expect(result.items).toHaveLength(5);
    expect(result).toMatchObject({ total: 25, page: 2, pageSize: 20 });
    await expect(
      searchPublicProperties({ query: "x".repeat(121), page: 1, pageSize: 20 }, database),
    ).rejects.toMatchObject({ code: "INVALID_SEARCH" });
    await expect(
      searchPublicProperties({ query: "", page: 0, pageSize: 20 }, database),
    ).rejects.toMatchObject({ code: "INVALID_SEARCH" });
    await expect(
      searchPublicProperties({ query: "", page: 1, pageSize: 21 }, database),
    ).rejects.toMatchObject({ code: "INVALID_SEARCH" });
  });
});

const TEST_ORIGIN = "https://admin.test.invalid";
const TEST_SESSION = {
  adminId: "test-admin",
  issuedAt: 1,
  expiresAt: 2,
  nonce: "test-nonce",
};

describe("featured admin API", () => {
  test("fails safely when the session boundary is unavailable", async () => {
    const secret = "private session boundary detail";
    const handlers = createFeaturedHandlers({
      readSession: async () => {
        throw new Error(secret);
      },
    });

    const response = await handlers.GET();
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toEqual({
      ok: false,
      error: "Сервис временно недоступен",
    });
    expect(body).not.toContain(secret);
  });

  test("requires an admin session for reads and writes", async () => {
    const replace = vi.fn();
    const handlers = createFeaturedHandlers({
      readSession: async () => null,
      readSiteOrigin: () => TEST_ORIGIN,
      getItems: async () => [],
      replace,
    });

    const getResponse = await handlers.GET();
    const postResponse = await handlers.POST(
      new Request(`${TEST_ORIGIN}/api/admin/featured`, {
        method: "POST",
        headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ ids: ["a"] }),
      }),
    );

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(replace).not.toHaveBeenCalled();
  });

  test("rejects a mutation from a non-exact Origin before replacement", async () => {
    const replace = vi.fn();
    const { POST } = createFeaturedHandlers({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      getItems: async () => [],
      replace,
    });

    const response = await POST(
      new Request(`${TEST_ORIGIN}/api/admin/featured`, {
        method: "POST",
        headers: {
          origin: `${TEST_ORIGIN}/`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ids: ["private-object-id"] }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "Запрос отклонён" });
    expect(replace).not.toHaveBeenCalled();
  });

  test("returns the newly saved ordered list", async () => {
    const source = property("a");
    const items = [{
      id: source.id,
      shortId: source.shortId,
      title: source.title,
      price: source.price,
      rooms: source.rooms,
      area: source.area,
      city: source.city,
      district: source.district,
      address: source.address,
      photo: null,
      isFeed: true,
    }];
    const replace = vi.fn(async () => undefined);
    const { POST } = createFeaturedHandlers({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      getItems: async () => items,
      replace,
    });

    const response = await POST(
      new Request(`${TEST_ORIGIN}/api/admin/featured`, {
        method: "POST",
        headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ ids: ["a"] }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, items });
    expect(replace).toHaveBeenCalledWith(["a"]);
  });

  test("maps domain validation to a safe Russian API error", async () => {
    const { POST } = createFeaturedHandlers({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      getItems: async () => [],
      replace: async () => {
        throw new FeaturedValidationError("DUPLICATE_IDS");
      },
    });
    const secretId = "private-secret-object-id";

    const response = await POST(
      new Request(`${TEST_ORIGIN}/api/admin/featured`, {
        method: "POST",
        headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ ids: [secretId, secretId] }),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(JSON.parse(body)).toEqual({
      ok: false,
      error: "Каждый объект можно выбрать только один раз",
    });
    expect(body).not.toContain(secretId);
  });
});

describe("admin property search API", () => {
  test("fails safely when the session boundary is unavailable", async () => {
    const secret = "private search session detail";
    const handler = createPropertySearchHandler({
      readSession: async () => {
        throw new Error(secret);
      },
    });

    const response = await handler(
      new Request(`${TEST_ORIGIN}/api/admin/properties?q=test&page=1`),
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toEqual({
      ok: false,
      error: "Сервис временно недоступен",
    });
    expect(body).not.toContain(secret);
  });

  test("requires a session and rejects query strings longer than 120 characters", async () => {
    const search = vi.fn();
    const unauthorized = createPropertySearchHandler({
      readSession: async () => null,
      search,
    });
    const authorized = createPropertySearchHandler({
      readSession: async () => TEST_SESSION,
      search,
    });

    expect(
      (
        await unauthorized(
          new Request(`${TEST_ORIGIN}/api/admin/properties?q=test&page=1`),
        )
      ).status,
    ).toBe(401);
    const response = await authorized(
      new Request(`${TEST_ORIGIN}/api/admin/properties?q=${"x".repeat(121)}&page=1`),
    );
    expect(response.status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  test("passes URL search params with a fixed page size of twenty", async () => {
    const search = vi.fn(async (input) => ({
      items: [],
      total: 0,
      ...input,
    }));
    const handler = createPropertySearchHandler({
      readSession: async () => TEST_SESSION,
      search,
    });

    const response = await handler(
      new Request(`${TEST_ORIGIN}/api/admin/properties?q=%D0%B4%D0%BE%D0%BC&page=2`),
    );

    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith({ query: "дом", page: 2, pageSize: 20 });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      page: 2,
      pageSize: 20,
    });
  });
});
