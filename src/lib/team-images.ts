import { randomUUID } from "node:crypto";
import { constants, type Dirent, type Stats } from "node:fs";
import {
  lstat,
  open,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import sharp from "sharp";
import { db } from "./db";
import {
  configuredTeamUploadDirectory,
  isCanonicalTeamImageId,
  isContainedPath,
  resolvePhysicalTeamUploadRoot,
  TeamImageConfigurationError,
} from "./team-image-files";
import {
  parseSiteContent,
  type SiteContentV1,
} from "./site-content/schema";
import { withSiteContentMutationLock } from "./site-content/mutation-lock";

export const TEAM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const TEAM_IMAGE_MAX_INPUT_PIXELS = 25_000_000;
const TEAM_IMAGE_MAX_DIMENSION = 1600;
const ORPHAN_MINIMUM_AGE_MS = 24 * 60 * 60 * 1000;
const UUID_WEBP =
  /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.webp$/;

type TeamImageStorageOptions = {
  uploadDirectory: string;
  appRoot?: string;
  contentClient?: unknown;
  fileSystem?: Partial<TeamImageFileSystem>;
};

type TeamImageFileSystem = {
  lstat(path: string): Promise<Stats>;
  open(path: string, flags: number): ReturnType<typeof open>;
  readdir(
    path: string,
    options: { withFileTypes: true },
  ): Promise<Dirent[]>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
  writeFile(
    path: string,
    data: Uint8Array,
    options: { flag: "wx"; mode: number },
  ): Promise<void>;
};

export {
  isCanonicalTeamImageId,
  TeamImageConfigurationError,
} from "./team-image-files";

export class TeamImageValidationError extends Error {
  constructor() {
    super("Team image is invalid");
    this.name = "TeamImageValidationError";
  }
}

function hasStrictPngEnvelope(bytes: Buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 20 || !bytes.subarray(0, 8).equals(signature)) {
    return false;
  }

  let offset = 8;
  let firstChunk = true;
  while (offset + 12 <= bytes.length) {
    const dataLength = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + dataLength;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.length) {
      return false;
    }
    const chunkType = bytes.toString("ascii", offset + 4, offset + 8);
    if (firstChunk && chunkType !== "IHDR") return false;
    firstChunk = false;
    if (chunkType === "IEND") {
      return dataLength === 0 && chunkEnd === bytes.length;
    }
    offset = chunkEnd;
  }
  return false;
}

function hasStrictJpegEnvelope(bytes: Buffer) {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  ) {
    return false;
  }

  let offset = 2;
  let insideEntropyData = false;
  while (offset < bytes.length) {
    if (insideEntropyData) {
      while (offset < bytes.length && bytes[offset] !== 0xff) {
        offset += 1;
      }
      if (offset >= bytes.length) return false;
      const markerStart = offset;
      while (offset < bytes.length && bytes[offset] === 0xff) {
        offset += 1;
      }
      if (offset >= bytes.length) return false;
      const marker = bytes[offset];
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 1;
        continue;
      }
      insideEntropyData = false;
      offset = markerStart;
      continue;
    }

    if (bytes[offset] !== 0xff) return false;
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= bytes.length) return false;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9) return offset === bytes.length;
    if (marker === 0x00 || marker === 0xd8) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > bytes.length) return false;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return false;
    }
    offset += segmentLength;
    if (marker === 0xda) insideEntropyData = true;
  }
  return false;
}

function hasStrictWebpEnvelope(bytes: Buffer) {
  return (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP" &&
    bytes.readUInt32LE(4) + 8 === bytes.length
  );
}

function hasStrictEnvelope(
  bytes: Buffer,
  format: string | undefined,
) {
  if (format === "jpeg") return hasStrictJpegEnvelope(bytes);
  if (format === "png") return hasStrictPngEnvelope(bytes);
  if (format === "webp") return hasStrictWebpEnvelope(bytes);
  return false;
}

async function transformTeamImage(bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > TEAM_IMAGE_MAX_BYTES) {
    throw new TeamImageValidationError();
  }
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    const metadata = await sharp(input, {
      failOn: "warning",
      limitInputPixels: TEAM_IMAGE_MAX_INPUT_PIXELS,
      limitInputChannels: 4,
      pages: 1,
    }).metadata();
    const width = metadata.width;
    const height = metadata.height;
    if (
      !hasStrictEnvelope(input, metadata.format) ||
      !width ||
      !height ||
      !Number.isSafeInteger(width * height) ||
      width * height > TEAM_IMAGE_MAX_INPUT_PIXELS ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new TeamImageValidationError();
    }

    const result = await sharp(input, {
      failOn: "warning",
      limitInputPixels: TEAM_IMAGE_MAX_INPUT_PIXELS,
      limitInputChannels: 4,
      pages: 1,
    })
      .rotate()
      .resize({
        width: TEAM_IMAGE_MAX_DIMENSION,
        height: TEAM_IMAGE_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp()
      .toBuffer({ resolveWithObject: true });
    if (
      result.info.format !== "webp" ||
      result.info.width > TEAM_IMAGE_MAX_DIMENSION ||
      result.info.height > TEAM_IMAGE_MAX_DIMENSION
    ) {
      throw new TeamImageValidationError();
    }
    return result.data;
  } catch (error) {
    if (error instanceof TeamImageValidationError) throw error;
    throw new TeamImageValidationError();
  }
}

type ContentTransaction = {
  siteContent: {
    findUnique(args: unknown): Promise<unknown>;
  };
};

async function loadContentVersions(
  rawTransaction: unknown,
): Promise<SiteContentV1[]> {
  const transaction = rawTransaction as ContentTransaction;
  const row = await transaction.siteContent.findUnique({
    where: { id: "site" },
    select: {
      draft: true,
      published: true,
      previousPublished: true,
    },
  });
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("Site content is unavailable");
  }
  const record = row as Record<string, unknown>;
  return [
    parseSiteContent(record.draft),
    parseSiteContent(record.published),
    ...(record.previousPublished === null ||
    record.previousPublished === undefined
      ? []
      : [parseSiteContent(record.previousPublished)]),
  ];
}

export function collectReferencedImageIds(
  contents: Iterable<SiteContentV1 | null | undefined>,
) {
  const ids = new Set<string>();
  for (const content of contents) {
    if (!content) continue;
    for (const member of content.team.members) {
      if (member.imageId && isCanonicalTeamImageId(member.imageId)) {
        ids.add(member.imageId);
      }
    }
  }
  return ids;
}

export function createTeamImageStorage(options: TeamImageStorageOptions) {
  if (!isAbsolute(options.uploadDirectory)) {
    throw new TeamImageConfigurationError();
  }
  const uploadDirectory = resolve(options.uploadDirectory);
  const appRoot = options.appRoot;
  const contentClient = options.contentClient ?? db;
  const fileSystem: TeamImageFileSystem = {
    lstat,
    open,
    readdir,
    rename,
    unlink,
    writeFile,
    ...options.fileSystem,
  };

  function resolveTeamImagePath(id: string): string | null {
    if (!isCanonicalTeamImageId(id)) return null;
    const candidate = resolve(uploadDirectory, `${id}.webp`);
    return isContainedPath(uploadDirectory, candidate) ? candidate : null;
  }

  async function storeTeamImage(
    bytes: Uint8Array,
    claimedType: string,
  ): Promise<{ id: string; url: string }> {
    void claimedType;
    const output = await transformTeamImage(bytes);
    const physicalRoot = await resolvePhysicalTeamUploadRoot({
      uploadDirectory,
      appRoot,
      create: true,
    });
    const id = randomUUID();
    const temporaryPath = join(
      physicalRoot,
      `.${id}.${randomUUID()}.tmp`,
    );
    const finalPath = join(physicalRoot, `${id}.webp`);
    if (
      !isContainedPath(physicalRoot, temporaryPath) ||
      !isContainedPath(physicalRoot, finalPath)
    ) {
      throw new TeamImageConfigurationError();
    }

    try {
      await fileSystem.writeFile(temporaryPath, output, {
        flag: "wx",
        mode: 0o600,
      });
      await fileSystem.rename(temporaryPath, finalPath);
      return { id, url: `/api/team-images/${id}` };
    } finally {
      try {
        await fileSystem.unlink(temporaryPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }
  }

  async function readTeamImage(id: string): Promise<Buffer | null> {
    if (!isCanonicalTeamImageId(id)) return null;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const physicalRoot = await resolvePhysicalTeamUploadRoot({
        uploadDirectory,
        appRoot,
        create: false,
      });
      const candidate = resolve(physicalRoot, `${id}.webp`);
      if (!isContainedPath(physicalRoot, candidate)) return null;
      const pathInfo = await fileSystem.lstat(candidate);
      if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) return null;
      handle = await fileSystem.open(
        candidate,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      const openedInfo = await handle.stat();
      if (!openedInfo.isFile()) return null;
      return await handle.readFile();
    } catch {
      return null;
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }

  async function cleanupOrphanTeamImages(now: Date): Promise<number> {
    if (!Number.isFinite(now.getTime())) {
      throw new TypeError("Cleanup dependencies are invalid");
    }
    return withSiteContentMutationLock(
      contentClient,
      async (transaction) => {
        const references = collectReferencedImageIds(
          await loadContentVersions(transaction),
        );
        const physicalRoot = await resolvePhysicalTeamUploadRoot({
          uploadDirectory,
          appRoot,
          create: false,
        });
        const entries = await fileSystem.readdir(physicalRoot, {
          withFileTypes: true,
        });
        let removed = 0;

        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const match = UUID_WEBP.exec(entry.name);
          if (!match || references.has(match[1])) continue;
          const candidate = resolve(physicalRoot, entry.name);
          if (!isContainedPath(physicalRoot, candidate)) continue;
          const info = await fileSystem.lstat(candidate);
          if (
            !info.isFile() ||
            info.isSymbolicLink() ||
            now.getTime() - info.mtimeMs < ORPHAN_MINIMUM_AGE_MS
          ) {
            continue;
          }
          await fileSystem.unlink(candidate);
          removed += 1;
        }
        return removed;
      }
    );
  }

  return {
    storeTeamImage,
    resolveTeamImagePath,
    readTeamImage,
    cleanupOrphanTeamImages,
  };
}

function defaultStorage() {
  return createTeamImageStorage({
    uploadDirectory: configuredTeamUploadDirectory(),
    contentClient: db,
  });
}

export async function storeTeamImage(
  bytes: Uint8Array,
  claimedType: string,
) {
  return defaultStorage().storeTeamImage(bytes, claimedType);
}

export function resolveTeamImagePath(id: string) {
  return defaultStorage().resolveTeamImagePath(id);
}

export async function readTeamImage(id: string) {
  return defaultStorage().readTeamImage(id);
}

export async function cleanupOrphanTeamImages(now: Date) {
  return defaultStorage().cleanupOrphanTeamImages(now);
}
