import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import {
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import {
  SiteContentValidationError,
  type SiteContentV1,
} from "./site-content/schema";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class TeamImageConfigurationError extends Error {
  constructor() {
    super("Team image storage is not configured");
    this.name = "TeamImageConfigurationError";
  }
}

export function isContainedPath(root: string, candidate: string) {
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

export function configuredTeamUploadDirectory(
  env: Record<string, string | undefined> = process.env,
) {
  const value = env.TEAM_UPLOAD_DIR?.trim();
  if (!value || !isAbsolute(value)) {
    throw new TeamImageConfigurationError();
  }
  return resolve(value);
}

function validateAbsoluteRoot(value: string) {
  if (!value || !isAbsolute(value)) {
    throw new TeamImageConfigurationError();
  }
  return resolve(value);
}

export async function resolvePhysicalTeamUploadRoot(options: {
  uploadDirectory: string;
  appRoot?: string;
  create: boolean;
}) {
  const uploadDirectory = validateAbsoluteRoot(options.uploadDirectory);
  const appRoot = validateAbsoluteRoot(
    options.appRoot ??
      resolve(/* turbopackIgnore: true */ process.cwd()),
  );
  if (isContainedPath(appRoot, uploadDirectory)) {
    throw new TeamImageConfigurationError();
  }
  if (options.create) {
    await mkdir(uploadDirectory, { recursive: true });
  }
  const [physicalUploadRoot, physicalAppRoot] = await Promise.all([
    realpath(uploadDirectory),
    realpath(/* turbopackIgnore: true */ appRoot),
  ]);
  if (isContainedPath(physicalAppRoot, physicalUploadRoot)) {
    throw new TeamImageConfigurationError();
  }
  return physicalUploadRoot;
}

async function regularTeamImageExists(root: string, id: string) {
  const candidate = resolve(root, `${id}.webp`);
  if (!isContainedPath(root, candidate)) return false;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const pathInfo = await lstat(candidate);
    if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) return false;
    handle = await open(
      candidate,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    return (await handle.stat()).isFile();
  } catch (error) {
    if (
      ["ENOENT", "ENOTDIR", "ELOOP"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    ) {
      return false;
    }
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

type ReferenceValidatorOptions = {
  uploadDirectory: string;
  appRoot?: string;
};

export function createTeamImageReferenceValidator(
  options: ReferenceValidatorOptions,
) {
  return async function validateTeamImageReferences(
    content: SiteContentV1,
  ) {
    const references = content.team.members.flatMap((member, index) =>
      member.imageId && isCanonicalTeamImageId(member.imageId)
        ? [{ id: member.imageId, index }]
        : [],
    );
    if (references.length === 0) return;
    const physicalRoot = await resolvePhysicalTeamUploadRoot({
      uploadDirectory: options.uploadDirectory,
      appRoot: options.appRoot,
      create: false,
    });
    const existence = new Map<string, boolean>();
    for (const { id } of references) {
      if (!existence.has(id)) {
        existence.set(id, await regularTeamImageExists(physicalRoot, id));
      }
    }
    const issues = references.flatMap(({ id, index }) =>
      existence.get(id)
        ? []
        : [
            {
              path: `team.members[${index}].imageId`,
              message: "uploaded image is unavailable",
            },
          ],
    );
    if (issues.length > 0) {
      throw new SiteContentValidationError(issues);
    }
  };
}

export async function validateConfiguredTeamImageReferences(
  content: SiteContentV1,
) {
  const hasUploadedReference = content.team.members.some(
    (member) =>
      member.imageId && isCanonicalTeamImageId(member.imageId),
  );
  if (!hasUploadedReference) return;
  return createTeamImageReferenceValidator({
    uploadDirectory: configuredTeamUploadDirectory(),
  })(content);
}
