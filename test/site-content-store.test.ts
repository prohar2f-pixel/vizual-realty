import { constants } from "node:fs";
import {
  access,
  mkdtemp,
  mkdir,
  readdir,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createContentHandlers } from "../src/app/api/admin/content/route";
import { createPublishHandler } from "../src/app/api/admin/publish/route";
import { createRollbackHandler } from "../src/app/api/admin/rollback/route";
import type { AdminSession } from "../src/lib/admin/session";
import { createTeamImageReferenceValidator } from "../src/lib/team-image-files";
import { createTeamImageStorage } from "../src/lib/team-images";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";
import {
  SiteContentValidationError,
  type SiteContentV1,
} from "../src/lib/site-content/schema";
import {
  createSiteContentStore,
  SiteContentConflictError,
  SiteContentStorageError,
} from "../src/lib/site-content/store";

type StoredSiteContent = {
  id: string;
  draft: unknown;
  published: unknown;
  previousPublished: unknown | null;
  draftUpdatedAt: Date;
  publishedAt: Date | null;
};

const ORPHAN_IMAGE_ID = "77777777-7777-4777-8777-777777777777";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function snapshot(heroTitle: string): SiteContentV1 {
  const value = clone(DEFAULT_SITE_CONTENT);
  value.home.heroTitle = heroTitle;
  value.footer.phone = "+79898028432";
  value.contacts.phone = "+79898028432";
  const memberPhones = [
    "+79495375565",
    "+79495780933",
    "+79494009274",
    "+79182956093",
    "+79496477256",
    "+79497158077",
    "+79780592669",
    "+79635328000",
  ];
  value.team.members.forEach((member, index) => {
    member.phone = memberPhones[index];
  });
  return value;
}

function storedRow(
  draft = snapshot("Черновик"),
  published = snapshot("Опубликовано"),
  previousPublished: SiteContentV1 | null = snapshot("Предыдущая версия"),
): StoredSiteContent {
  return {
    id: "site",
    draft: clone(draft),
    published: clone(published),
    previousPublished: clone(previousPublished),
    draftUpdatedAt: new Date("2026-07-26T06:00:00.000Z"),
    publishedAt: new Date("2026-07-26T06:30:00.000Z"),
  };
}

function createPrismaLikeClient(initial: StoredSiteContent | null) {
  let row = initial === null ? null : clone(initial);
  let failFind = false;
  let failTransactionUpdate = false;
  const operations: string[] = [];
  let transactionCount = 0;
  let rowLockTail = Promise.resolve();
  let mutationLockTail = Promise.resolve();

  function acquireRowLock(): Promise<() => void> {
    const previous = rowLockTail;
    let release: () => void = () => undefined;
    rowLockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(() => release);
  }

  function acquireMutationLock(): Promise<() => void> {
    const previous = mutationLockTail;
    let release: () => void = () => undefined;
    mutationLockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(() => release);
  }

  function project(current: StoredSiteContent | null) {
    return current === null ? null : clone(current);
  }

  function clientFor(
    read: () => StoredSiteContent | null,
    write: (next: StoredSiteContent) => void,
    prefix: string,
  ) {
    return {
      siteContent: {
        async findUnique() {
          operations.push(`${prefix}findUnique`);
          if (failFind) throw new Error("database-secret-detail");
          return project(read());
        },
        async update(args: {
          data: Partial<StoredSiteContent>;
          where: { id: string };
        }) {
          operations.push(`${prefix}update`);
          if (prefix === "tx." && failTransactionUpdate) {
            throw new Error("transaction-update-failed");
          }
          const current = read();
          if (!current || args.where.id !== "site") {
            throw new Error("record-not-found");
          }
          const next = {
            ...current,
            ...clone(args.data),
          };
          write(next);
          return project(next);
        },
      },
    };
  }

  const root = clientFor(
    () => row,
    (next) => {
      row = next;
    },
    "",
  );

  return {
    ...root,
    async $transaction<T>(run: (transaction: unknown) => Promise<T>) {
      operations.push("$transaction");
      transactionCount += 1;
      let working = row === null ? null : clone(row);
      let releaseRowLock: (() => void) | undefined;
      let releaseMutationLock: (() => void) | undefined;
      const transaction = {
        ...clientFor(
          () => working,
          (next) => {
            working = next;
          },
          "tx.",
        ),
        async $queryRaw<T>(query: unknown) {
          const text = String(
            (query as { strings?: readonly string[] })?.strings?.join(" ") ??
              "",
          );
          if (text.includes("pg_advisory_xact_lock")) {
            operations.push("tx.advisoryLock");
            releaseMutationLock = await acquireMutationLock();
            working = row === null ? null : clone(row);
          } else {
            operations.push("tx.rowLock");
            releaseRowLock = await acquireRowLock();
            working = row === null ? null : clone(row);
          }
          return (working === null ? [] : [{ id: "site" }]) as T;
        },
      };
      try {
        const result = await run(transaction);
        row = working;
        return result;
      } finally {
        releaseRowLock?.();
        releaseMutationLock?.();
      }
    },
    inspect() {
      return project(row);
    },
    operations,
    get transactionCount() {
      return transactionCount;
    },
    setFindFailure(value: boolean) {
      failFind = value;
    },
    setTransactionUpdateFailure(value: boolean) {
      failTransactionUpdate = value;
    },
  };
}

const tempDirectories: string[] = [];

async function makeTempDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "vizual-content-images-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("site content public reads", () => {
  test.each([
    ["a missing row", null, false],
    ["a database failure", storedRow(), true],
    [
      "invalid stored JSON",
      { ...storedRow(), published: { schemaVersion: 1, private: "value" } },
      false,
    ],
  ])("falls back safely for %s", async (_case, initial, failFind) => {
    const client = createPrismaLikeClient(initial);
    client.setFindFailure(failFind);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = createSiteContentStore(client);

    const result = await store.getPublishedContent();
    result.home.heroTitle = "Изменённый вызывающим кодом текст";
    const isolatedResult = await store.getPublishedContent();

    expect(isolatedResult).toEqual(DEFAULT_SITE_CONTENT);
    expect(isolatedResult).not.toBe(DEFAULT_SITE_CONTENT);
    expect(isolatedResult.home).not.toBe(DEFAULT_SITE_CONTENT.home);
    expect(error.mock.calls).toEqual([
      ["site_content_fallback"],
      ["site_content_fallback"],
    ]);
    expect(JSON.stringify(error.mock.calls)).not.toContain("private");
    expect(JSON.stringify(error.mock.calls)).not.toContain("database-secret-detail");
  });

  test("returns isolated validated published snapshots", async () => {
    const client = createPrismaLikeClient(storedRow());
    const store = createSiteContentStore(client);

    const first = await store.getPublishedContent();
    first.home.heroTitle = "Изменено локально";
    const second = await store.getPublishedContent();

    expect(second.home.heroTitle).toBe("Опубликовано");
    expect(client.inspect()?.published).toEqual(snapshot("Опубликовано"));
  });
});

describe("site content admin reads and draft writes", () => {
  test.each([
    ["missing", null],
    [
      "invalid",
      { ...storedRow(), draft: { schemaVersion: 1, private: "draft-secret" } },
    ],
  ])("rejects a %s persisted draft instead of masking it", async (_case, initial) => {
    const store = createSiteContentStore(createPrismaLikeClient(initial));

    await expect(store.getDraftContent()).rejects.toBeInstanceOf(
      SiteContentStorageError,
    );
  });

  test("strictly validates and saves only the draft snapshot", async () => {
    const before = storedRow();
    const client = createPrismaLikeClient(before);
    const store = createSiteContentStore(client);
    const input = snapshot("  Новый   черновик  ");

    const saved = await store.saveDraft(input);
    input.home.heroTitle = "Изменено после вызова";
    saved.home.heroTitle = "Изменено после сохранения";
    const after = client.inspect();

    expect(after?.draft).toMatchObject({
      home: { heroTitle: "Новый черновик" },
    });
    expect(after?.published).toEqual(before.published);
    expect(after?.previousPublished).toEqual(before.previousPublished);
    expect(after?.publishedAt).toEqual(before.publishedAt);
    expect(after?.draftUpdatedAt).toBeInstanceOf(Date);
    expect(after?.draftUpdatedAt).not.toEqual(before.draftUpdatedAt);
    expect(client.operations).toEqual([
      "$transaction",
      "tx.advisoryLock",
      "tx.findUnique",
      "tx.update",
    ]);
    await expect(
      store.saveDraft({ ...snapshot("Невалидный"), private: "not allowed" }),
    ).rejects.toMatchObject({
      issues: [{ path: "content.private", message: "is not allowed" }],
    });
  });

  test("rejects a draft that references a missing uploaded UUID without updating persistence", async () => {
    const uploadDirectory = await makeTempDirectory();
    const before = storedRow();
    const client = createPrismaLikeClient(before);
    const store = createSiteContentStore(client, {
      validateDraftImages: createTeamImageReferenceValidator({
        uploadDirectory,
      }),
    });
    const input = snapshot("Черновик с отсутствующим фото");
    input.team.members[0].imageId = ORPHAN_IMAGE_ID;

    await expect(store.saveDraft(input)).rejects.toMatchObject({
      issues: [
        {
          path: "team.members[0].imageId",
          message: "uploaded image is unavailable",
        },
      ],
    });

    expect(client.inspect()).toEqual(before);
    expect(client.operations).toEqual([
      "$transaction",
      "tx.advisoryLock",
      "tx.findUnique",
    ]);
  });

  test("accepts a draft UUID only when its generated WebP path is a regular file", async () => {
    const uploadDirectory = await makeTempDirectory();
    await writeFile(
      join(uploadDirectory, `${ORPHAN_IMAGE_ID}.webp`),
      "stored-image",
    );
    const client = createPrismaLikeClient(storedRow());
    const store = createSiteContentStore(client, {
      validateDraftImages: createTeamImageReferenceValidator({
        uploadDirectory,
      }),
    });
    const input = snapshot("Черновик с существующим фото");
    input.team.members[0].imageId = ORPHAN_IMAGE_ID;

    const saved = await store.saveDraft(input);

    expect(saved.team.members[0].imageId).toBe(ORPHAN_IMAGE_ID);
  });

  test("rejects a draft UUID whose generated WebP path is a symlink", async () => {
    const sandbox = await makeTempDirectory();
    const uploadDirectory = join(sandbox, "uploads");
    const target = join(sandbox, "outside.webp");
    await writeFile(target, "outside-image");
    await mkdir(uploadDirectory);
    try {
      await symlink(
        target,
        join(uploadDirectory, `${ORPHAN_IMAGE_ID}.webp`),
        "file",
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") return;
      throw error;
    }
    const client = createPrismaLikeClient(storedRow());
    const store = createSiteContentStore(client, {
      validateDraftImages: createTeamImageReferenceValidator({
        uploadDirectory,
      }),
    });
    const input = snapshot("Черновик с symlink фото");
    input.team.members[0].imageId = ORPHAN_IMAGE_ID;

    await expect(store.saveDraft(input)).rejects.toBeInstanceOf(
      SiteContentValidationError,
    );
    expect(client.operations).not.toContain("tx.update");
  });
});

describe("site content publication history", () => {
  test("publishes the draft and captures the prior publication atomically", async () => {
    const before = storedRow();
    const client = createPrismaLikeClient(before);
    const store = createSiteContentStore(client);

    const published = await store.publishDraft();
    const after = client.inspect();

    expect(published.home.heroTitle).toBe("Черновик");
    expect(after?.published).toEqual(before.draft);
    expect(after?.previousPublished).toEqual(before.published);
    expect(after?.draft).toEqual(before.draft);
    expect(after?.publishedAt).toBeInstanceOf(Date);
    expect(after?.publishedAt).not.toEqual(before.publishedAt);
    expect(client.transactionCount).toBe(1);
    expect(client.operations).toEqual([
      "$transaction",
      "tx.advisoryLock",
      "tx.rowLock",
      "tx.findUnique",
      "tx.update",
    ]);
  });

  test("does not expose a partial publish when the transactional update fails", async () => {
    const before = storedRow();
    const client = createPrismaLikeClient(before);
    client.setTransactionUpdateFailure(true);
    const store = createSiteContentStore(client);

    await expect(store.publishDraft()).rejects.toThrow(
      "transaction-update-failed",
    );

    expect(client.inspect()).toEqual(before);
  });

  test("swaps publications on rollback and permits an immediate reverse rollback", async () => {
    const client = createPrismaLikeClient(storedRow());
    const store = createSiteContentStore(client);

    const rolledBack = await store.rollbackPublished();
    const firstState = client.inspect();
    const reversed = await store.rollbackPublished();
    const secondState = client.inspect();

    expect(rolledBack.home.heroTitle).toBe("Предыдущая версия");
    expect(firstState?.published).toEqual(snapshot("Предыдущая версия"));
    expect(firstState?.previousPublished).toEqual(snapshot("Опубликовано"));
    expect(reversed.home.heroTitle).toBe("Опубликовано");
    expect(secondState?.published).toEqual(snapshot("Опубликовано"));
    expect(secondState?.previousPublished).toEqual(
      snapshot("Предыдущая версия"),
    );
    expect(client.transactionCount).toBe(2);
    expect(client.operations).toEqual([
      "$transaction",
      "tx.advisoryLock",
      "tx.rowLock",
      "tx.findUnique",
      "tx.update",
      "$transaction",
      "tx.advisoryLock",
      "tx.rowLock",
      "tx.findUnique",
      "tx.update",
    ]);
  });

  test("serializes concurrent rollbacks so two swaps restore the original pair", async () => {
    const before = storedRow();
    const client = createPrismaLikeClient(before);
    const store = createSiteContentStore(client);

    const [first, second] = await Promise.all([
      store.rollbackPublished(),
      store.rollbackPublished(),
    ]);

    expect(first.home.heroTitle).toBe("Предыдущая версия");
    expect(second.home.heroTitle).toBe("Опубликовано");
    expect(client.inspect()?.published).toEqual(before.published);
    expect(client.inspect()?.previousPublished).toEqual(
      before.previousPublished,
    );
  });

  test("rejects rollback without a previous publication and leaves state intact", async () => {
    const before = storedRow(
      snapshot("Черновик"),
      snapshot("Опубликовано"),
      null,
    );
    const client = createPrismaLikeClient(before);
    const store = createSiteContentStore(client);

    await expect(store.rollbackPublished()).rejects.toBeInstanceOf(
      SiteContentConflictError,
    );

    expect(client.inspect()).toEqual(before);
    expect(client.operations).toEqual([
      "$transaction",
      "tx.advisoryLock",
      "tx.rowLock",
      "tx.findUnique",
    ]);
  });
});

describe("site content image reference locking", () => {
  test("serializes cleanup and draft save so a successful save never references a deleted image", async () => {
    const uploadDirectory = await makeTempDirectory();
    const imagePath = join(uploadDirectory, `${ORPHAN_IMAGE_ID}.webp`);
    await writeFile(imagePath, "old-unreferenced-image");
    const old = new Date("2026-07-24T00:00:00.000Z");
    const now = new Date("2026-07-26T00:00:00.000Z");
    await utimes(imagePath, old, old);
    const client = createPrismaLikeClient(storedRow());
    let releaseCleanup: () => void = () => undefined;
    let markSnapshotRead: () => void = () => undefined;
    const snapshotRead = new Promise<void>((resolve) => {
      markSnapshotRead = resolve;
    });
    const cleanupMayContinue = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const imageStorage = createTeamImageStorage({
      uploadDirectory,
      contentClient: client,
      fileSystem: {
        async readdir(path) {
          markSnapshotRead();
          await cleanupMayContinue;
          return readdir(path, { withFileTypes: true });
        },
      },
    });
    const contentStore = createSiteContentStore(client, {
      validateDraftImages: createTeamImageReferenceValidator({
        uploadDirectory,
      }),
    });

    const cleanup = imageStorage.cleanupOrphanTeamImages(now);
    await snapshotRead;
    const next = snapshot("Черновик с новым фото");
    next.team.members[0].imageId = ORPHAN_IMAGE_ID;
    let saveSettled = false;
    const save = contentStore.saveDraft(next).then(
      (content) => {
        saveSettled = true;
        return { ok: true as const, content };
      },
      (error: unknown) => {
        saveSettled = true;
        return { ok: false as const, error };
      },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(saveSettled).toBe(false);

    releaseCleanup();

    await expect(cleanup).resolves.toBe(1);
    const saveResult = await save;
    expect(saveResult.ok).toBe(false);
    if (saveResult.ok) throw new Error("save unexpectedly succeeded");
    expect(saveResult.error).toBeInstanceOf(SiteContentValidationError);
    await expect(access(imagePath, constants.F_OK)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(client.inspect()?.draft).toEqual(storedRow().draft);
  });
});

const TEST_ORIGIN = "https://admin.test.invalid";
const TEST_SESSION: AdminSession = {
  adminId: "test-admin",
  issuedAt: 1,
  expiresAt: 2,
  nonce: "test-nonce",
};

function postRequest(path: string, body?: string, origin = TEST_ORIGIN) {
  return new Request(`${TEST_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      origin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body,
  });
}

describe("site content admin API", () => {
  test("requires a session before reads, origin checks, body reads, or writes", async () => {
    const getDraft = vi.fn();
    const save = vi.fn();
    const handlers = createContentHandlers({
      readSession: async () => null,
      readSiteOrigin: () => {
        throw new Error("origin must not be read");
      },
      getDraft,
      save,
    });

    const getResponse = await handlers.GET();
    const postResponse = await handlers.POST(
      postRequest("/api/admin/content", JSON.stringify(snapshot("Секрет"))),
    );

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(getDraft).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test("returns the draft and newly saved direct snapshot with private no-store responses", async () => {
    const original = snapshot("Исходный черновик");
    const next = snapshot("Новый черновик");
    const getDraft = vi.fn(async () => clone(original));
    const save = vi.fn(async () => clone(next));
    const handlers = createContentHandlers({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      getDraft,
      save,
    });

    const getResponse = await handlers.GET();
    const postResponse = await handlers.POST(
      postRequest("/api/admin/content", JSON.stringify(next)),
    );

    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("cache-control")).toBe("private, no-store");
    await expect(getResponse.json()).resolves.toEqual({
      ok: true,
      content: original,
    });
    expect(postResponse.status).toBe(200);
    await expect(postResponse.json()).resolves.toEqual({
      ok: true,
      content: next,
    });
    expect(save).toHaveBeenCalledWith(next);
  });

  test("rejects a non-exact Origin before parsing or saving content", async () => {
    const secret = "private-body-value";
    const save = vi.fn();
    const { POST } = createContentHandlers({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      getDraft: async () => snapshot("Черновик"),
      save,
    });

    const response = await POST(
      postRequest(
        "/api/admin/content",
        JSON.stringify({ secret }),
        `${TEST_ORIGIN}/`,
      ),
    );
    const text = await response.text();

    expect(response.status).toBe(403);
    expect(JSON.parse(text)).toEqual({
      ok: false,
      error: "Запрос отклонён",
    });
    expect(text).not.toContain(secret);
    expect(save).not.toHaveBeenCalled();
  });

  test("maps strict field validation to structured issues", async () => {
    const { POST } = createContentHandlers({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      getDraft: async () => snapshot("Черновик"),
      save: async () => {
        throw new SiteContentValidationError([
          { path: "home.heroTitle", message: "must not be empty" },
        ]);
      },
    });

    const response = await POST(
      postRequest(
        "/api/admin/content",
        JSON.stringify(snapshot("Некорректный snapshot")),
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      issues: [
        { path: "home.heroTitle", message: "must not be empty" },
      ],
    });
  });

  test("hard-limits a streamed content body to 256 KiB without Content-Length", async () => {
    const save = vi.fn();
    const { POST } = createContentHandlers({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      getDraft: async () => snapshot("Черновик"),
      save,
    });
    const request = postRequest(
      "/api/admin/content",
      JSON.stringify({ value: "x".repeat(256 * 1024) }),
    );
    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Некорректный запрос",
    });
    expect(save).not.toHaveBeenCalled();
  });

  test("does not expose database error details from draft reads or writes", async () => {
    const secret = "postgresql-private-detail";
    const handlers = createContentHandlers({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      getDraft: async () => {
        throw new Error(secret);
      },
      save: async () => {
        throw new Error(secret);
      },
    });

    const responses = [
      await handlers.GET(),
      await handlers.POST(
        postRequest(
          "/api/admin/content",
          JSON.stringify(snapshot("Черновик")),
        ),
      ),
    ];

    for (const response of responses) {
      const text = await response.text();
      expect(response.status).toBe(500);
      expect(JSON.parse(text)).toEqual({
        ok: false,
        error: "Сервис временно недоступен",
      });
      expect(text).not.toContain(secret);
    }
  });
});

describe("publish and rollback admin API", () => {
  test("publishes only after session and exact Origin checks", async () => {
    const publish = vi.fn(async () => snapshot("Опубликованный черновик"));
    const unauthorized = createPublishHandler({
      readSession: async () => null,
      readSiteOrigin: () => TEST_ORIGIN,
      publish,
    });
    const authorized = createPublishHandler({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      publish,
    });

    expect(
      (await unauthorized(postRequest("/api/admin/publish"))).status,
    ).toBe(401);
    expect(
      (
        await authorized(
          postRequest("/api/admin/publish", undefined, `${TEST_ORIGIN}/`),
        )
      ).status,
    ).toBe(403);
    expect(publish).not.toHaveBeenCalled();

    const response = await authorized(postRequest("/api/admin/publish"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      content: snapshot("Опубликованный черновик"),
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  test("returns a generic conflict when no rollback publication exists", async () => {
    const rollback = createRollbackHandler({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      rollback: async () => {
        throw new SiteContentConflictError();
      },
    });

    const response = await rollback(postRequest("/api/admin/rollback"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Предыдущая версия недоступна",
    });
  });

  test.each([
    ["publish", createPublishHandler, "/api/admin/publish", "publish"],
    ["rollback", createRollbackHandler, "/api/admin/rollback", "rollback"],
  ] as const)(
    "keeps %s database failures generic",
    async (_name, createHandler, path, dependencyName) => {
      const secret = "private-transaction-detail";
      const handler = createHandler({
        readSession: async () => TEST_SESSION,
        readSiteOrigin: () => TEST_ORIGIN,
        [dependencyName]: async () => {
          throw new Error(secret);
        },
      });

      const response = await handler(postRequest(path));
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(JSON.parse(text)).toEqual({
        ok: false,
        error: "Сервис временно недоступен",
      });
      expect(text).not.toContain(secret);
    },
  );
});
