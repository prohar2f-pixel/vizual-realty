import { constants } from "node:fs";
import {
  access,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createTeamImageUploadHandler } from "../src/app/api/admin/team-images/route";
import { createTeamImageGetHandler } from "../src/app/api/team-images/[id]/route";
import type { AdminSession } from "../src/lib/admin/session";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";
import type { SiteContentV1 } from "../src/lib/site-content/schema";
import {
  collectReferencedImageIds,
  createTeamImageStorage,
  TeamImageConfigurationError,
  TeamImageValidationError,
} from "../src/lib/team-images";

const TEST_ORIGIN = "https://admin.test.invalid";
const TEST_SESSION: AdminSession = {
  adminId: "test-admin",
  issuedAt: 1,
  expiresAt: 2,
  nonce: "test-nonce",
};
const TEN_MIB = 10 * 1024 * 1024;
const ELEVEN_MIB = 11 * 1024 * 1024;
const OLD = new Date("2026-07-24T00:00:00.000Z");
const NOW = new Date("2026-07-26T00:00:00.000Z");
const UUIDS = {
  draft: "11111111-1111-4111-8111-111111111111",
  published: "22222222-2222-4222-8222-222222222222",
  previous: "33333333-3333-4333-8333-333333333333",
  orphan: "44444444-4444-4444-8444-444444444444",
  young: "55555555-5555-4555-8555-555555555555",
} as const;

const tempDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function makeTempDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "vizual-team-images-"));
  tempDirectories.push(directory);
  return directory;
}

function snapshot(imageId: string): SiteContentV1 {
  const content = structuredClone(DEFAULT_SITE_CONTENT);
  content.team.members[0].imageId = imageId;
  return content;
}

function contentClient(contents: SiteContentV1[]) {
  const [draft, published, previousPublished] = contents;
  return {
    async $transaction<T>(run: (transaction: unknown) => Promise<T>) {
      return run({
        async $queryRaw() {
          return [];
        },
        siteContent: {
          async findUnique() {
            return {
              draft,
              published,
              previousPublished: previousPublished ?? null,
            };
          },
        },
      });
    },
  };
}

async function raster(
  format: "jpeg" | "png" | "webp",
  width = 48,
  height = 32,
) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 120, b: 70 },
    },
  })
    [format]()
    .toBuffer();
}

function uploadRequest(
  file: File,
  origin = TEST_ORIGIN,
  extraFiles: File[] = [],
) {
  const form = new FormData();
  form.append("file", file);
  for (const extra of extraFiles) form.append("file", extra);
  return new Request(`${TEST_ORIGIN}/api/admin/team-images`, {
    method: "POST",
    headers: { origin },
    body: form,
  });
}

describe("team image storage", () => {
  test.each(["jpeg", "png", "webp"] as const)(
    "accepts real %s bytes regardless of the claimed MIME and stores only generated WebP",
    async (format) => {
      const uploadDirectory = await makeTempDirectory();
      const storage = createTeamImageStorage({ uploadDirectory });
      const input = await raster(format);

      const stored = await storage.storeTeamImage(
        input,
        "image/svg+xml",
      );
      const files = await readdir(uploadDirectory);
      const output = await readFile(join(uploadDirectory, files[0]));
      const metadata = await sharp(output).metadata();
      const safelyRead = await storage.readTeamImage(stored.id);

      expect(stored).toEqual({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
        url: `/api/team-images/${stored.id}`,
      });
      expect(files).toEqual([`${stored.id}.webp`]);
      expect(files.join(" ")).not.toContain("portrait");
      expect(metadata).toMatchObject({ format: "webp", width: 32, height: 32 });
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(safelyRead).toEqual(output);
    },
  );

  test("auto-rotates and bounds the output to 1600px without enlargement", async () => {
    const uploadDirectory = await makeTempDirectory();
    const storage = createTeamImageStorage({ uploadDirectory });
    const input = await sharp({
      create: {
        width: 1200,
        height: 2000,
        channels: 3,
        background: "#c0ffee",
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const { id } = await storage.storeTeamImage(input, "image/jpeg");
    const metadata = await sharp(
      await readFile(join(uploadDirectory, `${id}.webp`)),
    ).metadata();

    expect(metadata).toMatchObject({
      format: "webp",
      width: 1200,
      height: 1200,
    });
    expect(metadata.orientation).toBeUndefined();
  });

  test.each([
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')],
    ["text", Buffer.from("not an image")],
  ])("rejects %s even when its claimed MIME is allowed", async (_label, bytes) => {
    const uploadDirectory = await makeTempDirectory();
    const storage = createTeamImageStorage({ uploadDirectory });

    await expect(
      storage.storeTeamImage(bytes, "image/png"),
    ).rejects.toBeInstanceOf(TeamImageValidationError);
    await expect(readdir(uploadDirectory)).resolves.toEqual([]);
  });

  test("rejects an otherwise valid raster with an appended polyglot payload", async () => {
    const uploadDirectory = await makeTempDirectory();
    const storage = createTeamImageStorage({ uploadDirectory });
    const png = await raster("png");
    const polyglot = Buffer.concat([
      png,
      Buffer.from("<script>outside-the-image</script>"),
    ]);

    await expect(
      storage.storeTeamImage(polyglot, "image/png"),
    ).rejects.toBeInstanceOf(TeamImageValidationError);
    await expect(readdir(uploadDirectory)).resolves.toEqual([]);
  });

  test("rejects a JPEG payload hidden after its first terminal EOI", async () => {
    const uploadDirectory = await makeTempDirectory();
    const storage = createTeamImageStorage({ uploadDirectory });
    const jpeg = await raster("jpeg");
    const jpegWithPayloadAndSecondEoi = Buffer.concat([
      jpeg,
      Buffer.from("hidden-payload"),
      Buffer.from([0xff, 0xd9]),
    ]);

    await expect(
      storage.storeTeamImage(jpegWithPayloadAndSecondEoi, "image/jpeg"),
    ).rejects.toBeInstanceOf(TeamImageValidationError);
    await expect(readdir(uploadDirectory)).resolves.toEqual([]);
  });

  test("rejects more than 10 MiB before decode and bounds input pixels", async () => {
    const uploadDirectory = await makeTempDirectory();
    const storage = createTeamImageStorage({ uploadDirectory });
    const oversized = Buffer.alloc(TEN_MIB + 1, 0);
    const excessivePixels = await sharp({
      create: {
        width: 5001,
        height: 5000,
        channels: 3,
        background: "#123456",
      },
    })
      .png()
      .toBuffer();
    expect(excessivePixels.byteLength).toBeLessThan(TEN_MIB);

    await expect(
      storage.storeTeamImage(oversized, "image/png"),
    ).rejects.toBeInstanceOf(TeamImageValidationError);
    await expect(
      storage.storeTeamImage(excessivePixels, "image/png"),
    ).rejects.toBeInstanceOf(TeamImageValidationError);
    await expect(readdir(uploadDirectory)).resolves.toEqual([]);
  });

  test("resolves only canonical generated UUIDs without client paths or extensions", async () => {
    const uploadDirectory = await makeTempDirectory();
    const storage = createTeamImageStorage({ uploadDirectory });

    expect(storage.resolveTeamImagePath(UUIDS.draft)).toBe(
      join(uploadDirectory, `${UUIDS.draft}.webp`),
    );
    for (const id of [
      "../secret",
      "..\\secret",
      `${UUIDS.draft}.webp`,
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      "legacy-photo",
      "",
    ]) {
      expect(storage.resolveTeamImagePath(id)).toBeNull();
    }
  });

  test("removes a known partial temp file when write rejects", async () => {
    const uploadDirectory = await makeTempDirectory();
    const storage = createTeamImageStorage({
      uploadDirectory,
      fileSystem: {
        async writeFile(path, data, options) {
          await writeFile(path, data, options);
          throw new Error("injected-partial-write-failure");
        },
      },
    });

    await expect(
      storage.storeTeamImage(await raster("png"), "image/png"),
    ).rejects.toThrow("injected-partial-write-failure");
    await expect(readdir(uploadDirectory)).resolves.toEqual([]);
  });

  test("rejects an external upload symlink whose physical root is inside the app root", async () => {
    const sandbox = await makeTempDirectory();
    const appRoot = join(sandbox, "app");
    const physicalUpload = join(appRoot, "private-uploads");
    const externalLink = join(sandbox, "external-upload-link");
    await mkdir(physicalUpload, { recursive: true });
    try {
      await symlink(
        physicalUpload,
        externalLink,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") return;
      throw error;
    }
    const storage = createTeamImageStorage({
      uploadDirectory: externalLink,
      appRoot,
    });

    await expect(
      storage.storeTeamImage(await raster("png"), "image/png"),
    ).rejects.toBeInstanceOf(TeamImageConfigurationError);
    await expect(readdir(physicalUpload)).resolves.toEqual([]);
  });
});

describe("team image upload API", () => {
  test("checks session and exact Origin before consuming the request body", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    const request = new Request(`${TEST_ORIGIN}/api/admin/team-images`, {
      method: "POST",
      headers: {
        origin: TEST_ORIGIN,
        "content-type": "multipart/form-data; boundary=test",
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const store = vi.fn();
    const unauthorized = createTeamImageUploadHandler({
      readSession: async () => null,
      readSiteOrigin: () => {
        throw new Error("must not read origin configuration");
      },
      store,
    });

    const unauthorizedResponse = await unauthorized(request);

    expect(unauthorizedResponse.status).toBe(401);
    expect(request.bodyUsed).toBe(false);
    expect(store).not.toHaveBeenCalled();

    const invalidOrigin = createTeamImageUploadHandler({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      store,
    });
    const png = await raster("png");
    const originResponse = await invalidOrigin(
      uploadRequest(
        new File([png], "private-name.png", { type: "image/png" }),
        `${TEST_ORIGIN}/`,
      ),
    );

    expect(originResponse.status).toBe(403);
    expect(store).not.toHaveBeenCalled();
  });

  test.each([
    ["absent Content-Length", undefined],
    ["lying Content-Length", "1"],
  ])("hard-caps 11 MiB + 1 streamed bytes before formData with %s", async (_case, contentLength) => {
    const store = vi.fn();
    const handler = createTeamImageUploadHandler({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      store,
    });
    const request = new Request(`${TEST_ORIGIN}/api/admin/team-images`, {
      method: "POST",
      headers: {
        origin: TEST_ORIGIN,
        "content-type": "multipart/form-data; boundary=oversized",
        ...(contentLength === undefined
          ? {}
          : { "content-length": contentLength }),
      },
      body: Buffer.alloc(ELEVEN_MIB + 1),
    });
    const formData = vi.spyOn(Request.prototype, "formData");

    const response = await handler(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Некорректный файл",
    });
    expect(formData).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  test("allows multipart overhead above 10 MiB while keeping the file itself at 10 MiB", async () => {
    const store = vi.fn(async (
      bytes: Uint8Array,
      claimedType: string,
    ) => {
      void bytes;
      void claimedType;
      return {
        id: UUIDS.draft,
        url: `/api/team-images/${UUIDS.draft}`,
      };
    });
    const handler = createTeamImageUploadHandler({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      store,
    });

    const response = await handler(
      uploadRequest(
        new File([Buffer.alloc(TEN_MIB)], "exact-limit.png", {
          type: "image/png",
        }),
      ),
    );

    expect(response.status).toBe(201);
    expect(store).toHaveBeenCalledOnce();
    expect(store.mock.calls[0][0]).toHaveLength(TEN_MIB);
  });

  test("requires multipart with exactly one file and returns a new imageId", async () => {
    const png = await raster("png");
    const store = vi.fn(async (bytes: Uint8Array, claimedType: string) => {
      void bytes;
      void claimedType;
      return {
        id: UUIDS.draft,
        url: `/api/team-images/${UUIDS.draft}`,
      };
    });
    const handler = createTeamImageUploadHandler({
      readSession: async () => TEST_SESSION,
      readSiteOrigin: () => TEST_ORIGIN,
      store,
    });
    const plainResponse = await handler(
      new Request(`${TEST_ORIGIN}/api/admin/team-images`, {
        method: "POST",
        headers: { origin: TEST_ORIGIN, "content-type": "text/plain" },
        body: "private body",
      }),
    );
    const malformedResponse = await handler(
      new Request(`${TEST_ORIGIN}/api/admin/team-images`, {
        method: "POST",
        headers: {
          origin: TEST_ORIGIN,
          "content-type": "multipart/form-data; boundary=broken",
        },
        body: "not-a-multipart-body",
      }),
    );
    const multipleResponse = await handler(
      uploadRequest(
        new File([png], "one.png", { type: "image/png" }),
        TEST_ORIGIN,
        [new File([png], "two.jpg", { type: "image/jpeg" })],
      ),
    );
    const successResponse = await handler(
      uploadRequest(
        new File([png], "../../private-name.svg", {
          type: "image/svg+xml",
        }),
      ),
    );

    expect(plainResponse.status).toBe(400);
    expect(malformedResponse.status).toBe(400);
    expect(multipleResponse.status).toBe(400);
    expect(successResponse.status).toBe(201);
    await expect(successResponse.json()).resolves.toEqual({
      ok: true,
      imageId: UUIDS.draft,
      url: `/api/team-images/${UUIDS.draft}`,
    });
    expect(store).toHaveBeenCalledTimes(1);
    const [bytes, claimedType] = store.mock.calls[0];
    expect(Buffer.from(bytes)).toEqual(png);
    expect(claimedType).toBe("image/svg+xml");
  });
});

describe("public team image API", () => {
  test("serves canonical images with fixed safe headers and generic misses", async () => {
    const image = await raster("webp");
    const readImage = vi.fn(async (id: string) =>
      id === UUIDS.draft ? image : null,
    );
    const GET = createTeamImageGetHandler({ readImage });

    const response = await GET(new Request(`${TEST_ORIGIN}/unused`), {
      params: Promise.resolve({ id: UUIDS.draft }),
    });
    const missing = await GET(new Request(`${TEST_ORIGIN}/unused`), {
      params: Promise.resolve({ id: "../private-path" }),
    });
    const missingText = await missing.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(image);
    expect(missing.status).toBe(404);
    expect(missingText).toBe("Not Found");
    expect(missingText).not.toContain("private-path");
  });
});

describe("orphan team image cleanup", () => {
  test("collects references from draft, published, and previous publication", () => {
    const contents = [
      snapshot(UUIDS.draft),
      snapshot(UUIDS.published),
      snapshot(UUIDS.previous),
    ];

    expect(collectReferencedImageIds(contents)).toEqual(
      new Set([UUIDS.draft, UUIDS.published, UUIDS.previous]),
    );
  });

  test("deletes only old unreferenced canonical regular WebP files", async () => {
    const uploadDirectory = await makeTempDirectory();
    const contents = [
      snapshot(UUIDS.draft),
      snapshot(UUIDS.published),
      snapshot(UUIDS.previous),
    ];
    const storage = createTeamImageStorage({
      uploadDirectory,
      contentClient: contentClient(contents),
    });
    const retainedIds = [UUIDS.draft, UUIDS.published, UUIDS.previous];
    const canonicalIds = [...retainedIds, UUIDS.orphan, UUIDS.young];
    for (const id of canonicalIds) {
      const file = join(uploadDirectory, `${id}.webp`);
      await writeFile(file, id);
      await utimes(file, OLD, id === UUIDS.young ? NOW : OLD);
    }
    const legacy = join(uploadDirectory, "ayanot-elena.webp");
    const unrelated = join(uploadDirectory, "notes.txt");
    await writeFile(legacy, "legacy");
    await writeFile(unrelated, "unrelated");
    await utimes(legacy, OLD, OLD);
    await utimes(unrelated, OLD, OLD);

    let symlinkPath: string | undefined;
    try {
      symlinkPath = join(uploadDirectory, UUIDS.orphan.replace(/^4/, "6") + ".webp");
      await symlink(unrelated, symlinkPath, "file");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EACCES") throw error;
      symlinkPath = undefined;
    }

    const removed = await storage.cleanupOrphanTeamImages(NOW);

    expect(removed).toBe(1);
    await expect(access(join(uploadDirectory, `${UUIDS.orphan}.webp`), constants.F_OK)).rejects.toMatchObject({ code: "ENOENT" });
    for (const path of [
      ...retainedIds.map((id) => join(uploadDirectory, `${id}.webp`)),
      join(uploadDirectory, `${UUIDS.young}.webp`),
      legacy,
      unrelated,
      ...(symlinkPath ? [symlinkPath] : []),
    ]) {
      await expect(access(path, constants.F_OK)).resolves.toBeUndefined();
    }
    if (symlinkPath) {
      expect((await lstat(symlinkPath)).isSymbolicLink()).toBe(true);
      const symlinkId = basename(symlinkPath, ".webp");
      await expect(storage.readTeamImage(symlinkId)).resolves.toBeNull();
    }
  });
});

describe("team image cleanup script", () => {
  test("does not start production cleanup when imported", async () => {
    const cleanup = vi.fn(async () => 0);
    vi.resetModules();
    vi.doMock("../src/lib/team-images", () => ({
      cleanupOrphanTeamImages: cleanup,
    }));

    await import("../scripts/cleanup-team-images");

    expect(cleanup).not.toHaveBeenCalled();
    vi.doUnmock("../src/lib/team-images");
  });
});
