import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import sharp from "sharp";
import { db } from "./db";
import {
  parseSiteContent,
  type SiteContentV1,
} from "./site-content/schema";

export const TEAM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const TEAM_IMAGE_MAX_INPUT_PIXELS = 25_000_000;
const TEAM_IMAGE_MAX_DIMENSION = 1600;
const ORPHAN_MINIMUM_AGE_MS = 24 * 60 * 60 * 1000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_WEBP =
  /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.webp$/;

type ContentVersionsReader = () => Promise<
  ReadonlyArray<SiteContentV1 | null | undefined>
>;

type TeamImageStorageOptions = {
  uploadDirectory: string;
  readContentVersions?: ContentVersionsReader;
};

export class TeamImageConfigurationError extends Error {
  constructor() {
    super("Team image storage is not configured");
    this.name = "TeamImageConfigurationError";
  }
}

export class TeamImageValidationError extends Error {
  constructor() {
    super("Team image is invalid");
    this.name = "TeamImageValidationError";
  }
}

function configuredUploadDirectory(
  env: Record<string, string | undefined> = process.env,
) {
  const value = env.TEAM_UPLOAD_DIR?.trim();
  if (!value || !isAbsolute(value)) {
    throw new TeamImageConfigurationError();
  }
  const directory = resolve(value);
  if (
    isContainedPath(
      resolve(/* turbopackIgnore: true */ process.cwd()),
      directory,
    )
  ) {
    throw new TeamImageConfigurationError();
  }
  return directory;
}

function validateUploadDirectory(value: string) {
  if (!value || !isAbsolute(value)) {
    throw new TeamImageConfigurationError();
  }
  return resolve(value);
}

function isContainedPath(root: string, candidate: string) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith(`..${sep}`) &&
      pathFromRoot !== ".." &&
      !isAbsolute(pathFromRoot))
  );
}

export function isCanonicalTeamImageId(id: string) {
  return typeof id === "string" && UUID_V4.test(id);
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
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  );
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

async function defaultContentVersions(): Promise<SiteContentV1[]> {
  const row = await db.siteContent.findUnique({
    where: { id: "site" },
    select: {
      draft: true,
      published: true,
      previousPublished: true,
    },
  });
  if (!row) throw new Error("Site content is unavailable");
  return [
    parseSiteContent(row.draft),
    parseSiteContent(row.published),
    ...(row.previousPublished === null
      ? []
      : [parseSiteContent(row.previousPublished)]),
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
  const uploadDirectory = validateUploadDirectory(options.uploadDirectory);
  const readContentVersions = options.readContentVersions;

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
    await mkdir(uploadDirectory, { recursive: true });
    const physicalRoot = await realpath(uploadDirectory);
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

    let temporaryWasWritten = false;
    try {
      await writeFile(temporaryPath, output, { flag: "wx", mode: 0o600 });
      temporaryWasWritten = true;
      await rename(temporaryPath, finalPath);
      temporaryWasWritten = false;
      return { id, url: `/api/team-images/${id}` };
    } catch (error) {
      if (temporaryWasWritten) {
        await unlink(temporaryPath).catch(() => undefined);
      }
      throw error;
    }
  }

  async function readTeamImage(id: string): Promise<Buffer | null> {
    if (!isCanonicalTeamImageId(id)) return null;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const physicalRoot = await realpath(uploadDirectory);
      const candidate = resolve(physicalRoot, `${id}.webp`);
      if (!isContainedPath(physicalRoot, candidate)) return null;
      const pathInfo = await lstat(candidate);
      if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) return null;
      handle = await open(
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
    if (!readContentVersions || !Number.isFinite(now.getTime())) {
      throw new TypeError("Cleanup dependencies are invalid");
    }
    const references = collectReferencedImageIds(
      await readContentVersions(),
    );
    const physicalRoot = await realpath(uploadDirectory);
    const entries = await readdir(physicalRoot, { withFileTypes: true });
    let removed = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = UUID_WEBP.exec(entry.name);
      if (!match || references.has(match[1])) continue;
      const candidate = resolve(physicalRoot, entry.name);
      if (!isContainedPath(physicalRoot, candidate)) continue;
      const info = await lstat(candidate);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        now.getTime() - info.mtimeMs < ORPHAN_MINIMUM_AGE_MS
      ) {
        continue;
      }
      await unlink(candidate);
      removed += 1;
    }
    return removed;
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
    uploadDirectory: configuredUploadDirectory(),
    readContentVersions: defaultContentVersions,
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
